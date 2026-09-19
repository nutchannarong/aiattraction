"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/** Side-by-side route styles from one drafting run; pick one to edit below. */
export function PlanOptions({
  options,
  failed,
  chosen,
  currentPlan,
  onChoose,
}: {
  options: PlanOption[];
  failed: FailedOption[];
  chosen: RouteStyle;
  /** The plan being edited (may differ from its stored option after edits). */
  currentPlan: TripPlan;
  onChoose: (style: RouteStyle) => void;
}) {
  const stats = options.map((o) => statsOf(o.style, o.style === chosen ? currentPlan : o.plan));
  const best = (pick: (s: Stats) => number, dir: 1 | -1) => {
    if (stats.length < 2) return null;
    const sorted = [...stats].sort((a, b) => dir * (pick(a) - pick(b)));
    return pick(sorted[0]) === pick(sorted[1]) ? null : sorted[0].style;
  };
  const fastest = best((s) => s.driveMin, 1);
  const cheapest = best((s) => s.total, 1);
  const mostStops = best((s) => s.stops, -1);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        ร่างไว้ {options.length} แบบเส้นทาง เลือกแบบที่ชอบเพื่อดูและแก้แผนรายวันด้านล่าง
        (แก้แบบไหนไว้ สลับกลับมาก็ยังอยู่)
      </p>
      <div
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2"
        role="group"
        aria-label="แผนการเดินทางที่ร่างไว้"
      >
        {stats.map((s) => {
          const info = ROUTE_STYLES.find((r) => r.key === s.style);
          const selected = s.style === chosen;
          return (
            <button
              key={s.style}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(s.style)}
              className={cn(
                "flex w-64 flex-none snap-start flex-col gap-2 rounded-card border-2 bg-surface p-3.5 text-left transition sm:w-72",
                selected ? "border-accent shadow-hard" : "border-border hover:border-foreground",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-display font-bold leading-snug">
                  {info?.label ?? s.style}
                </span>
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
          );
        })}
        {failed.map((f) => (
          <div
            key={f.style}
            className="flex w-64 flex-none snap-start flex-col gap-1.5 rounded-card border-2 border-dashed border-border bg-surface-2 p-3.5 text-sm text-subtle sm:w-72"
          >
            <span className="font-display font-bold text-muted">
              {ROUTE_STYLES.find((r) => r.key === f.style)?.label ?? f.style}
            </span>
            <span className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
              {f.error}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
