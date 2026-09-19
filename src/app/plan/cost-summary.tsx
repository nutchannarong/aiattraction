"use client";

import { costTotals } from "@/lib/planner/edit";
import { COST_LABEL, type CostCategory, type TripPlan } from "@/lib/planner/plan-types";
import { travellers } from "@/lib/planner/schedule";
import type { PlannerDraft } from "@/lib/planner/types";
import { baht } from "./day-plan";

const ORDER: CostCategory[] = ["fuel", "travel", "admission", "food", "lodging", "other"];

export function CostSummary({ draft, plan }: { draft: PlannerDraft; plan: TripPlan }) {
  const { totals, total } = costTotals(plan);
  const people = Math.max(1, travellers(draft));
  const finished = plan.days.filter((d) => d.finished).length;
  const max = Math.max(1, ...Object.values(totals));

  return (
    <div className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard">
      <div className="space-y-2.5 px-4 py-4">
        {ORDER.map((k) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <p className="text-sm">
              {k === "fuel" ? "ค่าน้ำมัน / ค่าเดินทาง (ประมาณจากระยะทาง)" : COST_LABEL[k]}
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums">{baht(totals[k])}</p>
            <div
              className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(totals[k] / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-foreground bg-surface-2 px-4 py-3.5">
        <div>
          <p className="text-xs text-subtle">รวมทั้งหมด</p>
          <p className="font-display text-2xl font-bold text-accent">{baht(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-subtle">เฉลี่ยต่อคน ({people} คน)</p>
          <p className="font-mono text-lg font-semibold">{baht(total / people)}</p>
        </div>
      </div>
      <p className="border-t-[1.5px] border-dashed border-border px-4 py-2.5 text-xs text-subtle">
        {finished === plan.days.length
          ? "จบกิจกรรมครบทุกวันแล้ว ยอดนี้คือสรุปของแผน"
          : `จบกิจกรรมแล้ว ${finished}/${plan.days.length} วัน ยอดจะเปลี่ยนตามที่แก้ในแผนรายวัน`}{" "}
        · ค่าที่พักที่จองแล้วใช้ราคาที่กรอกไว้ตอนจอง
      </p>
    </div>
  );
}
