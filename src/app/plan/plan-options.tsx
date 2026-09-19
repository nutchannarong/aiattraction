"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { Markdown } from "@/components/markdown-lite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { describeRoute, routeHeadline, routeStyleLabel } from "@/lib/assistant/route-summary";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/geo";
import { costTotals } from "@/lib/planner/edit";
import type { TripPlan } from "@/lib/planner/plan-types";
import { ROUTE_STYLES, type RouteStyle } from "@/lib/planner/types";
import { baht } from "./day-plan";
import type { FailedOption, PlanOption } from "./use-saved-plan";

type Stats = {
  style: RouteStyle;
  km: number;
  driveMin: number;
  fuel: number;
  total: number;
  stops: number;
  secondary: number;
  names: string[];
};

type Advice = { text: string; status: "loading" | "done" | "error"; error?: string };

function statsOf(style: RouteStyle, plan: TripPlan): Stats {
  const visits = plan.days
    .flatMap((d) => d.items)
    .filter((i) => i.kind === "attraction" && i.place);
  return {
    style,
    km: plan.totals.distanceKm,
    driveMin: plan.totals.driveMin,
    fuel: plan.totals.fuelCost,
    total: costTotals(plan).total,
    stops: visits.length,
    secondary: visits.filter((i) => i.place!.isSecondaryCity).length,
    names: visits.slice(0, 3).map((i) => i.place!.name),
  };
}

const styleName = (style: RouteStyle) => ROUTE_STYLES.find((r) => r.key === style)?.label ?? style;

/** Side-by-side route styles from one drafting run; pick one to edit, or ask AI about each. */
export function PlanOptions({
  options,
  failed,
  chosen,
  currentPlan,
  tripSummary,
  onChoose,
}: {
  options: PlanOption[];
  failed: FailedOption[];
  chosen: RouteStyle;
  /** The plan being edited (may differ from its stored option after edits). */
  currentPlan: TripPlan;
  /** Planner answers as text, for the AI advice. */
  tripSummary: string;
  onChoose: (style: RouteStyle) => void;
}) {
  const [advice, setAdvice] = useState<Partial<Record<RouteStyle, Advice>>>({});
  const [showing, setShowing] = useState<RouteStyle | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const planOf = (style: RouteStyle) =>
    style === chosen ? currentPlan : options.find((o) => o.style === style)!.plan;
  const stats = options.map((o) => statsOf(o.style, planOf(o.style)));
  const best = (pick: (s: Stats) => number, dir: 1 | -1) => {
    if (stats.length < 2) return null;
    const sorted = [...stats].sort((a, b) => dir * (pick(a) - pick(b)));
    return pick(sorted[0]) === pick(sorted[1]) ? null : sorted[0].style;
  };
  const fastest = best((s) => s.driveMin, 1);
  const cheapest = best((s) => s.total, 1);
  const mostStops = best((s) => s.stops, -1);

  const ask = async (style: RouteStyle, refresh = false) => {
    setShowing(style);
    const current = advice[style];
    if (!refresh && current && current.status !== "error") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const set = (a: Advice) => setAdvice((all) => ({ ...all, [style]: a }));
    set({ text: "", status: "loading" });
    try {
      const res = await fetch("/api/route-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: routeStyleLabel(style),
          route: describeRoute(style, planOf(style)),
          others: options
            .filter((o) => o.style !== style)
            .map((o) => `- ${routeHeadline(o.style, planOf(o.style))}`)
            .join("\n"),
          trip: tripSummary,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "ขอคำแนะนำไม่สำเร็จ กรุณาลองใหม่");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        set({ text, status: "loading" });
      }
      const [answer, failure] = text.split("[[error]]");
      set(
        failure
          ? { text: answer.trim(), status: "error", error: failure.trim() }
          : { text, status: "done" },
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      set({ text: "", status: "error", error: (error as Error).message });
    }
  };

  const shown = showing ? advice[showing] : undefined;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        ร่างไว้ {options.length} แบบเส้นทาง เลือกแบบที่ชอบเพื่อดูและแก้แผนรายวันด้านล่าง
        (แก้แบบไหนไว้ สลับกลับมาก็ยังอยู่) หรือกด “AI แนะนำ” ให้ช่วยวิเคราะห์ทีละเส้น
      </p>
      <div
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2"
        role="group"
        aria-label="แผนการเดินทางที่ร่างไว้"
      >
        {stats.map((s) => {
          const selected = s.style === chosen;
          return (
            <div
              key={s.style}
              className={cn(
                "flex w-64 flex-none snap-start flex-col overflow-hidden rounded-card border-2 bg-surface transition sm:w-72",
                selected ? "border-accent shadow-hard" : "border-border hover:border-foreground",
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChoose(s.style)}
                className="flex flex-1 flex-col gap-2 p-3.5 text-left"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display font-bold leading-snug">{styleName(s.style)}</span>
                  {selected && (
                    <CheckCircle2 className="size-5 flex-none text-accent" aria-hidden="true" />
                  )}
                </span>
                <span className="flex flex-wrap gap-1">
                  {fastest === s.style && <Badge tone="info">เร็วที่สุด</Badge>}
                  {cheapest === s.style && <Badge tone="secondary">ประหยัดที่สุด</Badge>}
                  {mostStops === s.style && <Badge tone="accent">แวะเยอะสุด</Badge>}
                </span>
                <span className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-subtle">ระยะทาง</span>
                  <span className="text-right font-mono font-semibold">
                    {Math.round(s.km).toLocaleString("th-TH")} กม.
                  </span>
                  <span className="text-subtle">เวลาขับ</span>
                  <span className="text-right font-mono font-semibold">
                    {formatDuration(s.driveMin)}
                  </span>
                  <span className="text-subtle">ค่าน้ำมัน</span>
                  <span className="text-right font-mono font-semibold">{baht(s.fuel)}</span>
                  <span className="text-subtle">รวมทั้งทริป</span>
                  <span className="text-right font-mono font-semibold text-accent">
                    {baht(s.total)}
                  </span>
                  <span className="text-subtle">จุดแวะเที่ยว</span>
                  <span className="text-right font-mono font-semibold">
                    {s.stops} จุด{s.secondary ? ` · เมืองรอง ${s.secondary}` : ""}
                  </span>
                </span>
                {s.names.length > 0 && (
                  <span className="line-clamp-2 border-t-[1.5px] border-dashed border-border pt-2 text-xs text-subtle">
                    แวะ: {s.names.join(" · ")}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => void ask(s.style)}
                aria-expanded={showing === s.style}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-1.5 border-t-2 border-dashed border-border text-xs font-semibold hover:bg-accent-soft",
                  showing === s.style && "bg-accent-soft",
                )}
              >
                <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
                ให้ AI แนะนำเส้นทาง
              </button>
            </div>
          );
        })}
        {failed.map((f) => (
          <div
            key={f.style}
            className="flex w-64 flex-none snap-start flex-col gap-1.5 rounded-card border-2 border-dashed border-border bg-surface-2 p-3.5 text-sm text-subtle sm:w-72"
          >
            <span className="font-display font-bold text-muted">{styleName(f.style)}</span>
            <span className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
              {f.error}
            </span>
          </div>
        ))}
      </div>

      {showing && shown && (
        <section
          aria-label={`คำแนะนำจาก AI: ${styleName(showing)}`}
          className="rounded-card border-2 border-foreground bg-surface-3 shadow-hard"
        >
          <header className="flex items-center gap-2 border-b-2 border-dashed border-border px-4 py-2.5">
            <Sparkles className="size-4 flex-none text-accent" aria-hidden="true" />
            <p className="min-w-0 flex-1 font-display font-bold">AI แนะนำ: {styleName(showing)}</p>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setShowing(null);
              }}
              className="grid size-9 place-items-center rounded-full hover:bg-surface"
              aria-label="ปิดคำแนะนำ"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="space-y-3 px-4 py-3 text-sm leading-relaxed" aria-live="polite">
            {shown.text && <Markdown text={shown.text} />}
            {shown.status === "loading" && !shown.text && (
              <p className="flex items-center gap-2 text-muted">
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                กำลังวิเคราะห์เส้นทางนี้…
              </p>
            )}
            {shown.status === "error" && (
              <p className="text-sm font-semibold text-danger">{shown.error}</p>
            )}
            {shown.status !== "loading" && (
              <div className="flex flex-wrap gap-2">
                {showing !== chosen && (
                  <Button variant="mini" onClick={() => onChoose(showing)}>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" /> ใช้เส้นนี้
                  </Button>
                )}
                <Button variant="mini" onClick={() => void ask(showing, true)}>
                  <RefreshCw className="size-3.5" aria-hidden="true" /> ขอคำแนะนำใหม่
                </Button>
              </div>
            )}
            <p className="text-[11px] text-subtle">
              วิเคราะห์โดย AI ของ OpenAI จากข้อมูลแผนนี้ อาจคลาดเคลื่อน
              ตรวจสภาพถนนและสถานที่ก่อนเดินทาง
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
