"use client";

import {
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Markdown } from "@/components/markdown-lite";
import { buttonClass } from "@/components/ui/button";

type AdminChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string | null;
  error?: string | null;
  pending?: boolean;
};

const STORAGE_KEY = "thainhaidee:admin-ai-chat";
const MAX_INPUT = 1000;

const SUGGESTIONS = [
  "📊 สรุปภาพรวมและแนวโน้มการเติบโตของผู้ใช้",
  "🗺️ วิเคราะห์จังหวัดปลายทางและสัดส่วนเมืองรอง",
  "⏰ พฤติกรรมเวลาออกเดินทางและความยาวทริป",
  "🚗 สัดส่วนประเภทยานพาหนะและการใช้พลังงาน EV",
  "💰 ประมาณการค่าใช้จ่ายเฉลี่ยต่อทริปและค่าน้ำมัน",
  "💡 ข้อเสนอแนะเชิงกลยุทธ์สำหรับพัฒนาแพลตฟอร์ม",
];

function loadStoredMessages(): AdminChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AdminChatMessage[]) : [];
    return Array.isArray(parsed)
      ? parsed.map((m) => ({ ...m, pending: false, status: null }))
      : [];
  } catch {
    return [];
  }
}

export function AdminAiChat({ range }: { range: { from: string; to: string } }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AdminChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      const done = messages.filter((m) => !m.pending && !m.error);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(done.slice(-25)));
    } catch {
      /* ignore storage errors */
    }
  }, [messages]);

  // Auto scroll to bottom
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  // Focus textarea on open
  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const updateMessage = (
    id: string,
    updater: (m: AdminChatMessage) => AdminChatMessage,
  ) => {
    setMessages((all) => all.map((m) => (m.id === id ? updater(m) : m)));
  };

  const send = async (textToSend: string) => {
    const question = textToSend.trim();
    if (!question || busy) return;

    const userMsg: AdminChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const replyMsg: AdminChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "กำลังวิเคราะห์ข้อมูล…",
      pending: true,
    };

    const history = [...messages, userMsg]
      .filter((m) => m.content.trim() && !m.error)
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    setMessages((all) => [...all, userMsg, replyMsg]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/admin/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          range,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errJson?.error ?? "ไม่สามารถรับการวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง");
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
          };

          if (event.type === "text" && event.delta) {
            updateMessage(replyMsg.id, (m) => ({
              ...m,
              content: m.content + event.delta,
              status: null,
            }));
          } else if (event.type === "status") {
            updateMessage(replyMsg.id, (m) => ({ ...m, status: event.message ?? null }));
          } else if (event.type === "error") {
            updateMessage(replyMsg.id, (m) => ({
              ...m,
              error: event.message ?? "การวิเคราะห์ขัดข้อง",
            }));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateMessage(replyMsg.id, (m) => ({
          ...m,
          error: (err as Error).message,
        }));
      }
    } finally {
      updateMessage(replyMsg.id, (m) => ({
        ...m,
        pending: false,
        status: null,
      }));
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClass(
            "cta",
            "fixed bottom-5 right-5 z-40 flex items-center gap-2 border-2 border-foreground bg-accent px-4 py-2.5 font-bold text-white shadow-hard hover:translate-x-px hover:translate-y-px hover:shadow-none dark:text-black sm:bottom-6 sm:right-6",
          )}
          aria-label="เปิด AI วิเคราะห์ข้อมูล"
        >
          <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
          <span>AI วิเคราะห์ข้อมูล</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border-2 border-foreground bg-surface shadow-hard sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(42rem,calc(100dvh-6rem))] sm:w-[28rem]"
        >
          {/* Header */}
          <header className="flex items-center gap-2.5 border-b-2 border-foreground bg-surface-2 px-4 py-3">
            <span className="grid size-9 flex-none place-items-center rounded-full border-2 border-foreground bg-accent text-white dark:text-black shadow-hard-sm">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display font-bold leading-tight text-sm sm:text-base">
                AI วิเคราะห์ข้อมูล · Admin
              </h2>
              <p className="truncate text-[11px] text-subtle">
                ช่วงข้อมูล: {range.from} ถึง {range.to}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  setMessages([]);
                  sessionStorage.removeItem(STORAGE_KEY);
                }}
                className="grid size-9 place-items-center rounded-full hover:bg-surface"
                aria-label="เริ่มแชทใหม่"
                title="เริ่มแชทใหม่"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-9 place-items-center rounded-full hover:bg-surface"
              aria-label="ปิดหน้าต่าง AI"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          {/* Messages Area */}
          <div ref={listRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border-[1.5px] border-border bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
                  <p className="font-bold text-foreground">
                    สวัสดีครับ! ผมคือผู้ช่วยวิเคราะห์ข้อมูลระบบแอดมิน Thainhaidee
                  </p>
                  <p className="mt-1">
                    ผมพร้อมช่วยวิเคราะห์สถิติ พฤติกรรมผู้ใช้ ทริป ปลายทาง ยานพาหนะ และการเงิน
                    ตามรายงานจริงในช่วงวันที่คุณเลือก ({range.from} ถึง {range.to})
                  </p>
                </div>
                <p className="text-xs font-semibold text-subtle">คำถามแนะนำด่วน:</p>
                <div className="flex flex-col items-start gap-1.5">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void send(item)}
                      className="w-full rounded-xl border-[1.5px] border-border bg-surface px-3 py-2 text-left text-xs font-medium hover:border-foreground hover:bg-surface-2"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border-2 border-foreground bg-accent-soft px-3.5 py-2.5 text-xs sm:text-sm">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="space-y-1.5">
                  {m.content && (
                    <div className="rounded-2xl rounded-bl-sm border-[1.5px] border-border bg-surface-3 px-3.5 py-3 text-xs leading-relaxed sm:text-sm">
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
                  {m.error && (
                    <div className="rounded-xl border border-danger bg-danger-soft p-3 text-xs font-semibold text-danger">
                      {m.error}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          {/* Input Footer */}
          <form
            className="border-t-2 border-foreground bg-surface-2 px-3.5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor={`${titleId}-input`} className="sr-only">
                พิมพ์คำถามวิเคราะห์ข้อมูล
              </label>
              <textarea
                id={`${titleId}-input`}
                ref={inputRef}
                rows={2}
                value={input}
                maxLength={MAX_INPUT}
                placeholder="ถามเรื่องวิเคราะห์ข้อมูลสถิติ เช่น สัดส่วนเมืองรอง, พฤติกรรมผู้ใช้…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border-[1.5px] border-border bg-surface px-3 py-2 text-xs sm:text-sm focus:border-accent focus:outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="grid size-11 flex-none place-items-center rounded-full border-2 border-foreground bg-surface"
                  aria-label="หยุดตอบ"
                  title="หยุดตอบ"
                >
                  <Square className="size-4 fill-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="grid size-11 flex-none place-items-center rounded-full border-2 border-foreground bg-accent text-white disabled:opacity-40 dark:text-black shadow-hard-sm"
                  aria-label="ส่งคำถาม"
                >
                  <Send className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-subtle">
              AI ให้บริการเฉพาะการวิเคราะห์ข้อมูลและสถิติในระบบแอดมินเท่านั้น · ประมวลผลผ่าน OpenRouter
            </p>
          </form>
        </section>
      )}
    </>
  );
}
