"use client";

import {
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown-lite";
import { buttonClass } from "@/components/ui/button";
import { buildAssistantContext } from "@/lib/assistant/context";
import { formatDistance } from "@/lib/geo";
import type { NearbyPlace } from "@/lib/planner/nearby";
import type { TripPlan } from "@/lib/planner/plan-types";
import { lookupLinks } from "@/lib/planner/poi-categories";
import type { PlaceGroupOption, PlannerDraft } from "@/lib/planner/types";
import { ASSISTANT_CHAT_KEY } from "./storage-keys";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  places?: NearbyPlace[];
  status?: string | null;
  error?: string | null;
  pending?: boolean;
};

const MAX_INPUT = 1000;

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(ASSISTANT_CHAT_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed) ? parsed.map((m) => ({ ...m, pending: false, status: null })) : [];
  } catch {
    return [];
  }
}

// ---- Suggestions depend on how far the user has got.

function suggestionsFor(draft: PlannerDraft, plan: TripPlan | null) {
  const dest = draft.destination?.label;
  if (plan && dest) {
    return [
      "ช่วยดูแผนหน่อยว่าวันไหนแน่นหรือขับนานเกินไป",
      `ร้านอาหารพื้นเมืองน่าลองใน${dest}`,
      "มีที่เที่ยวระหว่างทางที่น่าแวะเพิ่มไหม",
      "ทริปนี้ควรเตรียมอะไรบ้าง",
    ];
  }
  if (dest) {
    return [
      `แนะนำที่เที่ยวใน${dest}ที่เหมาะกับกลุ่มเรา`,
      `อากาศที่${dest}ช่วงที่ไปเป็นยังไง`,
      `ร้านอาหารพื้นเมืองน่าลองใน${dest}`,
    ];
  }
  return [
    "แนะนำจังหวัดเมืองรองที่ขับรถไปเที่ยว 3 วันได้",
    "ขับรถทางไกลควรเตรียมอะไรบ้าง",
    "เดือนนี้เที่ยวภาคไหนดี",
  ];
}

function placeKey(p: NearbyPlace) {
  return `${p.place.source}:${p.place.id ?? p.place.name}`;
}

export function AssistantChat({
  draft,
  plan,
  groups,
  onAddPlace,
}: {
  draft: PlannerDraft;
  plan: TripPlan | null;
  groups: PlaceGroupOption[];
  /** Adds a suggested place to the daily plan; null when there's no plan yet. */
  onAddPlace: ((place: NearbyPlace) => void) | null;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const done = messages.filter((m) => !m.pending);
      sessionStorage.setItem(ASSISTANT_CHAT_KEY, JSON.stringify(done.slice(-30)));
    } catch {
      // Storage blocked: the chat still works for this visit.
    }
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const update = (id: string, fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  const send = async (text: string) => {
    const question = text.trim().slice(0, MAX_INPUT);
    if (!question || busy) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      places: [],
      status: "กำลังคิด…",
      pending: true,
    };
    const history = [...messages, userMsg]
      .filter((m) => m.content.trim() && !m.error)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    setMessages((all) => [...all, userMsg, reply]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: buildAssistantContext(draft, plan, groups),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "ผู้ช่วยตอบไม่สำเร็จ กรุณาลองใหม่");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            delta?: string;
            message?: string;
            items?: NearbyPlace[];
          };
          if (event.type === "text" && event.delta) {
            update(reply.id, (m) => ({ ...m, content: m.content + event.delta, status: null }));
          } else if (event.type === "status") {
            update(reply.id, (m) => ({ ...m, status: event.message ?? null }));
          } else if (event.type === "places" && event.items) {
            update(reply.id, (m) => {
              const seen = new Set((m.places ?? []).map(placeKey));
              const fresh = event.items!.filter((p) => !seen.has(placeKey(p)));
              return { ...m, places: [...(m.places ?? []), ...fresh] };
            });
          } else if (event.type === "error") {
            update(reply.id, (m) => ({ ...m, error: event.message ?? "ตอบไม่สำเร็จ" }));
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        update(reply.id, (m) => ({ ...m, error: (error as Error).message }));
      }
    } finally {
      // Keep only cards for places the answer actually names.
      update(reply.id, (m) => ({
        ...m,
        pending: false,
        status: null,
        places: (m.places ?? []).filter((p) => m.content.includes(p.place.name)).slice(0, 6),
      }));
      setBusy(false);
      abortRef.current = null;
    }
  };

  const suggestions = suggestionsFor(draft, plan);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClass(
            "cta",
            "fixed bottom-4 right-4 z-40 shadow-hard sm:bottom-6 sm:right-6",
          )}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          ถามผู้ช่วย AI
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="fixed inset-x-2 bottom-2 top-20 z-50 flex flex-col overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(40rem,calc(100dvh-7rem))] sm:w-[27rem]"
        >
          <header className="flex items-center gap-2.5 border-b-2 border-foreground bg-surface-2 px-3.5 py-2.5">
            <span className="grid size-9 flex-none place-items-center rounded-full border-2 border-foreground bg-accent text-white dark:text-black">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display font-bold leading-tight">
                น้องไหนดี · ผู้ช่วย AI
              </h2>
              <p className="truncate text-[11px] text-subtle">
                {draft.destination
                  ? `รู้ข้อมูลทริป ${draft.origin?.label ?? "…"} → ${draft.destination.label}${plan ? " และแผนรายวัน" : ""}`
                  : "ช่วยคิดที่เที่ยว เส้นทาง และการเตรียมตัว"}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setMessages([]);
                }}
                className="grid size-10 place-items-center rounded-full hover:bg-surface"
                aria-label="เริ่มแชทใหม่"
                title="เริ่มแชทใหม่"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-full hover:bg-surface"
              aria-label="ปิดผู้ช่วย"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  สวัสดีครับ ถามเรื่องทริปได้เลย เช่น ที่เที่ยว ร้านอาหาร ที่พัก อากาศ
                  หรือให้ช่วยดูว่าแผนแน่นไปไหม ผมจะค้นจากข้อมูล ททท. และแผนที่ให้
                </p>
                <div className="flex flex-col items-start gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="min-h-10 rounded-xl border-[1.5px] border-border bg-surface px-3 py-2 text-left text-sm hover:border-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border-2 border-foreground bg-accent-soft px-3 py-2 text-sm">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  {m.content && (
                    <div className="rounded-2xl rounded-bl-md border-[1.5px] border-border bg-surface-3 px-3 py-2.5 text-sm leading-relaxed">
                      <Markdown text={m.content} />
                    </div>
                  )}
                  {m.pending && m.status && (
                    <p className="flex items-center gap-2 text-xs text-subtle">
                      <Loader2
                        className="size-3.5 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      {m.status}
                    </p>
                  )}
                  {m.error && <p className="text-xs font-semibold text-danger">{m.error}</p>}
                  {!m.pending && (m.places?.length ?? 0) > 0 && (
                    <ul className="space-y-1.5" aria-label="สถานที่ที่แนะนำ">
                      {m.places!.map((p) => (
                        <li
                          key={placeKey(p)}
                          className="flex items-center gap-2 rounded-xl border-[1.5px] border-border bg-surface px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                              {p.place.name}
                              {p.place.isSecondaryCity && <Badge tone="brand">เมืองรอง</Badge>}
                            </p>
                            <p className="truncate text-xs text-subtle">
                              {[
                                p.kindLabel,
                                p.distanceM ? formatDistance(p.distanceM) : null,
                                p.place.area,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <a
                            href={lookupLinks(p.place.name, p.place.area)[0].href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid size-9 flex-none place-items-center rounded-lg border-[1.5px] border-border hover:border-foreground"
                            aria-label={`ดู ${p.place.name} ใน Google Maps`}
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                          </a>
                          {onAddPlace && (
                            <button
                              type="button"
                              onClick={() => onAddPlace(p)}
                              className="inline-flex h-9 flex-none items-center gap-1 whitespace-nowrap rounded-lg border-[1.5px] border-foreground bg-surface px-2.5 text-xs font-semibold hover:bg-accent-soft"
                            >
                              <Plus className="size-3.5" aria-hidden="true" /> เพิ่มลงแผน
                            </button>
                          )}
                        </li>
                      ))}
                      {!onAddPlace && (
                        <li className="text-[11px] text-subtle">
                          กดร่างแผนการเดินทางก่อน แล้วจะเพิ่มสถานที่เหล่านี้ลงแผนรายวันได้
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ),
            )}
          </div>

          <form
            className="border-t-2 border-foreground bg-surface-2 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor={`${titleId}-input`} className="sr-only">
                พิมพ์คำถามถึงผู้ช่วย
              </label>
              <textarea
                id={`${titleId}-input`}
                ref={inputRef}
                rows={2}
                value={input}
                maxLength={MAX_INPUT}
                placeholder="ถามเรื่องทริปได้เลย…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[10px] border-[1.5px] border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="grid size-11 flex-none place-items-center rounded-full border-2 border-foreground bg-surface"
                  aria-label="หยุดตอบ"
                >
                  <Square className="size-4 fill-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="grid size-11 flex-none place-items-center rounded-full border-2 border-foreground bg-accent text-white disabled:opacity-40 dark:text-black"
                  aria-label="ส่งคำถาม"
                >
                  <Send className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-subtle">
              คำตอบจาก AI อาจคลาดเคลื่อน ตรวจเวลาเปิดและราคาก่อนไป · คำถามและสรุปทริป (ไม่มีพิกัด)
              ถูกส่งไปประมวลผลผ่าน OpenRouter
            </p>
          </form>
        </section>
      )}
    </>
  );
}
