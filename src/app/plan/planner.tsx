"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StepSection } from "@/components/ui/step-section";
import type { FuelPrice } from "@/lib/fuel";
import type { PlaceGroupOption, PlaceRef, PlannerDraft } from "@/lib/planner/types";
import {
  interestsSummary,
  daysBetween,
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
import { draftTripPlan } from "./actions";
import { PlanLoading, PlanResult } from "./plan-result";
import { usePlannerDraft } from "./use-planner-draft";
import { useSavedPlan } from "./use-saved-plan";

export type PlannerProps = {
  initialDraft: PlannerDraft;
  groups: PlaceGroupOption[];
  fuelPrices: FuelPrice[];
  homeProvince: PlaceRef | null;
};

/** What blocks an individual planner step, in Thai, or null when complete. */
export function missingForStep(d: PlannerDraft, step: number): string | null {
  if (step === 1) {
    if (!d.origin) return "เลือกจุดออกเดินทาง";
    if (!d.destination) return "เลือกจุดหมายปลายทาง";
    const days = daysBetween(d.startDate, d.endDate);
    if (days < 1) return "วันสุดท้ายของทริปต้องไม่ก่อนวันออกเดินทาง";
    if (days > 14) return "เลือกช่วงเดินทางไม่เกิน 14 วัน";
  }
  if (step === 2) {
    if (d.travelers.adults + d.travelers.children + d.travelers.seniors === 0)
      return "ใส่จำนวนผู้เดินทางอย่างน้อย 1 คน";
    if (d.travelers.adults > 0 && d.travelers.adultAges.length === 0)
      return "เลือกช่วงวัยของผู้ใหญ่";
    if (!d.occasion) return "เลือกโอกาสในการเดินทาง";
  }
  if (step === 3 && d.interests.length === 0)
    return "เลือกแนวท่องเที่ยวอย่างน้อย 1 แนว";
  if (step === 4 && d.stopKinds.length === 0)
    return "เลือกประเภทจุดแวะอย่างน้อย 1 แบบ";
  if (step === 5 && !(d.vehicle.fuelPrice > 0)) return "ใส่ราคาน้ำมัน";
  return null;
}

/** What still blocks drafting a plan, in Thai, or null when ready. */
export function missingForPlan(d: PlannerDraft): string | null {
  for (let step = 1; step <= 5; step += 1) {
    const missing = missingForStep(d, step);
    if (missing) return missing;
  }
  return null;
}

export function Planner({ initialDraft, groups, fuelPrices, homeProvince }: PlannerProps) {
  const { draft, patch, reset } = usePlannerDraft(initialDraft);
  const [open, setOpen] = useState<number | null>(1);
  const { saved, start, editPlan, markSaved, clear } = useSavedPlan();
  const [requested, setRequested] = useState<PlannerDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const missing = missingForPlan(draft);
  const stepErrors = [1, 2, 3, 4, 5].map((step) => missingForStep(draft, step));

  const compute = (d: PlannerDraft) => {
    setRequested(d);
    startTransition(async () => {
      const res = await draftTripPlan(d);
      if ("error" in res) {
        setError(res.error);
      } else {
        setError(null);
        start(d, res.plan);
      }
    });
  };

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
        {steps.map((s, i) => {
          const lockedBy = stepErrors.slice(0, i).find(Boolean);
          const error = stepErrors[i];
          return (
            <StepSection
              key={s.title}
              n={i + 1}
              title={s.title}
              summary={s.summary}
              open={!lockedBy && open === i + 1}
              disabled={Boolean(lockedBy)}
              disabledReason={lockedBy ? `กรอกขั้นก่อนหน้าให้ครบ: ${lockedBy}` : undefined}
              onToggle={() => setOpen(open === i + 1 ? null : i + 1)}
            >
              {s.body}
              {i < steps.length - 1 && (
                <div className="planner-step-actions mt-4">
                  {error ? (
                    <Callout tone="danger" className="w-full min-w-0">
                      ยังขาด: {error}
                    </Callout>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="ghost"
                    className="justify-self-end"
                    disabled={Boolean(error)}
                    onClick={() => setOpen(i + 2)}
                  >
                    ขั้นถัดไป: {steps[i + 1].title}
                  </Button>
                </div>
              )}
              {i === steps.length - 1 && error && (
                <Callout tone="danger" className="mt-4">
                  ยังขาด: {error}
                </Callout>
              )}
            </StepSection>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-foreground bg-surface px-4 py-3.5 shadow-hard">
        <p className="text-sm text-muted" aria-live="polite">
          {missing ? `ยังขาด: ${missing}` : "พร้อมแล้ว ระบบจะคำนวณเส้นทาง จุดแวะ และค่าใช้จ่ายให้"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("ล้างคำตอบและแผนที่ร่างไว้ทั้งหมดแล้วเริ่มใหม่?")) {
                reset();
                clear();
                setRequested(null);
                setError(null);
                setOpen(1);
              }
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            เริ่มใหม่
          </Button>
          <Button
            disabled={Boolean(missing) || pending}
            onClick={() => {
              if (
                saved?.edited &&
                !window.confirm("แผนรายวันที่แก้ไว้จะถูกแทนด้วยแผนที่ร่างใหม่ ต้องการร่างใหม่ไหม?")
              ) {
                return;
              }
              compute(draft);
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
        {saved ? (
          <PlanResult
            draft={saved.draft}
            plan={saved.plan}
            groups={groups}
            pending={pending}
            error={error}
            waypoints={draft.customWaypoints}
            onWaypointsChange={(customWaypoints) => patch({ customWaypoints })}
            onRecalculate={(customWaypoints) => compute({ ...saved.draft, customWaypoints })}
            onPlanChange={editPlan}
            tripId={saved.tripId}
            onSaved={markSaved}
          />
        ) : (
          requested && <PlanLoading error={error} onRetry={() => compute(requested)} />
        )}
      </div>
    </div>
  );
}
