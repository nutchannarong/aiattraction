"use client";

import { StickerCard } from "@/components/ui/sticker-card";
import type { PlaceGroupOption, PlannerDraft } from "@/lib/planner/types";
import { interestsSummary, stopsSummary, vehicleSummary, whereSummary, whoSummary } from "./steps";

/** The drafted trip. Route, map, daily plan and costs are added in later phases. */
export function PlanResult({ draft, groups }: { draft: PlannerDraft; groups: PlaceGroupOption[] }) {
  return (
    <StickerCard className="p-5">
      <h2 className="hl inline-block text-xl font-bold">ร่างแผนการเดินทาง</h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li>{whereSummary(draft)}</li>
        <li>{whoSummary(draft)}</li>
        <li>{interestsSummary(draft, groups)}</li>
        <li>{stopsSummary(draft)}</li>
        <li>{vehicleSummary(draft)}</li>
      </ul>
    </StickerCard>
  );
}
