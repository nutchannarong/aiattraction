"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepSection } from "@/components/ui/step-section";
import type { FuelPrice } from "@/lib/fuel";
import type { PlaceGroupOption, PlaceRef, PlannerDraft } from "@/lib/planner/types";
import {
  interestsSummary,
  StepInterests,
  StepStops,
  StepVehicle,
  StepWhere,
  StepWho,
  stopsSummary,
  vehicleSummary,
  whereSummary,
  whoSummary,
} from "./steps";
import { PlanResult } from "./plan-result";
import { usePlannerDraft } from "./use-planner-draft";

export type PlannerProps = {
  initialDraft: PlannerDraft;
  groups: PlaceGroupOption[];
  fuelPrices: FuelPrice[];
  homeProvince: PlaceRef | null;
};

/** What still blocks drafting a plan, in Thai, or null when ready. */
export function missingForPlan(d: PlannerDraft): string | null {
  if (!d.origin) return "เลือกจุดออกเดินทาง";
  if (!d.destination) return "เลือกจุดหมายปลายทาง";
  if (d.travelers.adults + d.travelers.children + d.travelers.seniors === 0)
    return "ใส่จำนวนผู้เดินทาง";
  if (!(d.vehicle.fuelPrice > 0)) return "ใส่ราคาน้ำมัน";
  return null;
}

export function Planner({ initialDraft, groups, fuelPrices, homeProvince }: PlannerProps) {
  const { draft, patch, reset } = usePlannerDraft(initialDraft);
  const [open, setOpen] = useState<number | null>(1);
  const [submitted, setSubmitted] = useState<PlannerDraft | null>(null);
  const missing = missingForPlan(draft);

  const steps = [
    {
      title: "จะไปไหน เมื่อไร",
      summary: whereSummary(draft),
      body: <StepWhere draft={draft} patch={patch} homeProvince={homeProvince} />,
    },
    {
      title: "เดินทางไปกับใคร",
      summary: whoSummary(draft),
      body: <StepWho draft={draft} patch={patch} />,
    },
    {
      title: "ไปแนวไหน",
      summary: interestsSummary(draft, groups),
      body: <StepInterests draft={draft} patch={patch} groups={groups} />,
    },
    {
      title: "อยากแวะที่แบบไหน",
      summary: stopsSummary(draft),
      body: <StepStops draft={draft} patch={patch} />,
    },
    {
      title: "เดินทางด้วยอะไร",
      summary: vehicleSummary(draft),
      body: <StepVehicle draft={draft} patch={patch} fuelPrices={fuelPrices} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {steps.map((s, i) => (
          <StepSection
            key={s.title}
            n={i + 1}
            title={s.title}
            summary={s.summary}
            open={open === i + 1}
            onToggle={() => setOpen(open === i + 1 ? null : i + 1)}
          >
            {s.body}
            {i < steps.length - 1 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" onClick={() => setOpen(i + 2)}>
                  ขั้นถัดไป: {steps[i + 1].title}
                </Button>
              </div>
            )}
          </StepSection>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-foreground bg-surface px-4 py-3.5 shadow-hard">
        <p className="text-sm text-muted" aria-live="polite">
          {missing ? `ยังขาด: ${missing}` : "พร้อมแล้ว ระบบจะคำนวณเส้นทาง จุดแวะ และค่าใช้จ่ายให้"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("ล้างคำตอบทั้งหมดแล้วเริ่มใหม่?")) {
                reset();
                setSubmitted(null);
                setOpen(1);
              }
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            เริ่มใหม่
          </Button>
          <Button
            disabled={Boolean(missing)}
            onClick={() => {
              setSubmitted(draft);
              setOpen(null);
              requestAnimationFrame(() =>
                document.getElementById("plan-result")?.scrollIntoView({ behavior: "smooth" }),
              );
            }}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            ร่างแผนการเดินทาง
          </Button>
        </div>
      </div>

      <div id="plan-result" className="scroll-mt-24">
        {submitted && (
          <PlanResult
            draft={submitted}
            groups={groups}
            waypoints={draft.customWaypoints}
            onWaypointsChange={(customWaypoints) => patch({ customWaypoints })}
          />
        )}
      </div>
    </div>
  );
}
