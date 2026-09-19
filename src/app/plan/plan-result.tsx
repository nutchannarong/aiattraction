"use client";

import { ExternalLink, Loader2, RefreshCw, Redo2, Trash2, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CategoryArt } from "@/components/category-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { SectionTitle } from "@/components/ui/section-title";
import { StatTile } from "@/components/ui/stat-tile";
import { formatDistance, formatDuration } from "@/lib/geo";
import { FUEL_TYPES } from "@/lib/fuel";
import { POI_CATEGORIES, poiCategoryOf } from "@/lib/planner/poi-categories";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { LatLng, PlaceGroupOption, PlannerDraft } from "@/lib/planner/types";
import { draftTripPlan } from "./actions";
import { baht, DayPlanList } from "./day-plan";

const TripMap = dynamic(() => import("@/components/trip-map"), {
  ssr: false,
  loading: () => (
    <div className="size-full animate-pulse bg-surface-2 motion-reduce:animate-none" />
  ),
});

function googleMapsUrl(draft: PlannerDraft, plan: TripPlan) {
  const o = draft.origin!;
  const d = draft.destination!;
  // Google Maps URLs accept up to 9 waypoints.
  const via = [
    ...plan.waypoints,
    ...plan.days[0].items.filter((i) => i.kind === "attraction" && i.place).map((i) => i.place!),
  ]
    .slice(0, 9)
    .map((p) => `${p.latitude},${p.longitude}`)
    .join("|");
  const mode = draft.vehicle.type === "motorcycle" ? "two-wheeler" : "driving";
  return `https://www.google.com/maps/dir/?api=1&origin=${o.latitude},${o.longitude}&destination=${d.latitude},${d.longitude}&travelmode=${mode}${via ? `&waypoints=${encodeURIComponent(via)}` : ""}`;
}

export function PlanResult({
  draft,
  groups,
  waypoints,
  onWaypointsChange,
}: {
  /** The answers the plan was drafted from. */
  draft: PlannerDraft;
  groups: PlaceGroupOption[];
  /** Live custom-route points (edited on the map before recalculating). */
  waypoints: LatLng[];
  onWaypointsChange: (points: LatLng[]) => void;
}) {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [visible, setVisible] = useState<string[]>(() =>
    POI_CATEGORIES.map((c) => c.key).filter((k) => k !== "other"),
  );
  // Custom route editing with undo/redo.
  const [history, setHistory] = useState<{ past: LatLng[][]; future: LatLng[][] }>({
    past: [],
    future: [],
  });

  const run = useCallback((d: PlannerDraft) => {
    startTransition(async () => {
      const res = await draftTripPlan(d);
      if ("error" in res) {
        setError(res.error);
      } else {
        setError(null);
        setPlan(res.plan);
      }
    });
  }, []);

  useEffect(() => {
    run(draft);
    // Re-run only when the submitted draft object changes.
  }, [draft, run]);

  const groupColors = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.key, g.color])),
    [groups],
  );
  const stops = useMemo(() => {
    if (!plan) return [];
    let n = 0;
    return plan.days.flatMap((day) =>
      day.items
        .filter((i) => i.kind === "attraction" && i.place)
        .map((i) => ({ place: i.place!, day: day.index, label: String(++n) })),
    );
  }, [plan]);
  const poiCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plan?.pois ?? [])
      counts[poiCategoryOf(p.kind).key] = (counts[poiCategoryOf(p.kind).key] ?? 0) + 1;
    return counts;
  }, [plan]);

  const points = waypoints;
  const setPoints = (next: LatLng[]) => {
    setHistory((h) => ({ past: [...h.past, points], future: [] }));
    onWaypointsChange(next);
  };

  if (!plan) {
    return (
      <div
        className="rounded-card border-2 border-foreground bg-surface p-6 shadow-hard"
        aria-live="polite"
      >
        {error ? (
          <Callout tone="danger" title="ร่างแผนไม่สำเร็จ">
            {error}
            <div className="mt-2">
              <Button variant="mini" onClick={() => run(draft)}>
                <RefreshCw className="size-3.5" aria-hidden="true" /> ลองใหม่
              </Button>
            </div>
          </Callout>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            กำลังคำนวณเส้นทาง เลือกจุดแวะ และจัดตารางรายวัน…
          </p>
        )}
      </div>
    );
  }

  const unit = FUEL_TYPES.find((f) => f.key === draft.vehicle.fuel)?.unit ?? "ลิตร";
  const totalCost =
    plan.days.flatMap((d) => d.items).reduce((n, i) => n + (i.costEstimate ?? 0), 0) +
    plan.totals.fuelCost;
  const tripDays = plan.days.length;

  return (
    <div className="space-y-2" aria-busy={pending}>
      <SectionTitle note="คำนวณจากรถ เวลาออกเดินทาง และพิกัดจริงของทุกจุด">
        ร่างแผนการเดินทาง
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          value={`${Math.round(plan.totals.distanceKm).toLocaleString("th-TH")} กม.`}
          label="ระยะทางรวม (ไป-กลับ)"
        />
        <StatTile value={formatDuration(plan.totals.driveMin)} label="เวลาขับรวม ไม่รวมแวะ" />
        <StatTile value={`${tripDays} วัน ${Math.max(0, tripDays - 1)} คืน`} label="ระยะเวลาทริป" />
        <StatTile value={plan.totals.stops} label="จุดแวะจากข้อมูล ททท." />
        <StatTile
          value={baht(plan.totals.fuelCost)}
          label={`ค่าน้ำมัน (${plan.totals.fuelUnits.toFixed(1)} ${unit})`}
          emphasis
        />
        <StatTile value={baht(totalCost)} label="ค่าใช้จ่ายโดยประมาณ" emphasis />
      </div>

      {pending && (
        <p className="flex items-center gap-2 pt-2 text-sm text-muted" aria-live="polite">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
          กำลังคำนวณใหม่…
        </p>
      )}
      {error && <Callout tone="danger">{error}</Callout>}

      <div className="grid gap-3.5 pt-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative h-[28rem] overflow-hidden rounded-card border-2 border-foreground bg-surface-2 shadow-hard lg:h-[34rem]">
          <TripMap
            outbound={plan.outbound.coordinates}
            inbound={plan.inbound?.coordinates ?? null}
            origin={{
              lat: draft.origin!.latitude,
              lng: draft.origin!.longitude,
              label: draft.origin!.label,
            }}
            destination={{
              lat: draft.destination!.latitude,
              lng: draft.destination!.longitude,
              label: draft.destination!.label,
            }}
            stops={stops}
            pois={plan.pois}
            visibleCategories={visible}
            groupColors={groupColors}
            editing={
              draft.routeStyle === "custom"
                ? {
                    points,
                    onAdd: (p) => setPoints([...points, p].slice(0, 15)),
                    onMove: (i, p) => setPoints(points.map((q, k) => (k === i ? p : q))),
                    onRemove: (i) => setPoints(points.filter((_, k) => k !== i)),
                  }
                : null
            }
          />
        </div>

        <aside className="space-y-3 rounded-card border-2 border-foreground bg-surface p-4 text-sm shadow-hard">
          <p className="font-bold">หมุดสถานที่รายทาง</p>
          <div className="flex flex-wrap gap-1.5">
            {POI_CATEGORIES.map((c) => (
              <Chip
                key={c.key}
                pressed={visible.includes(c.key)}
                onClick={() =>
                  setVisible((v) =>
                    v.includes(c.key) ? v.filter((k) => k !== c.key) : [...v, c.key],
                  )
                }
                count={poiCounts[c.key] ?? 0}
                className="min-h-9 px-2.5 text-xs"
              >
                <span
                  className="size-2.5 rounded-full border border-foreground"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="space-y-1 border-t-[1.5px] border-dashed border-border pt-2 text-xs text-muted">
            <p>
              <span className="mr-1 inline-block h-1 w-5 rounded bg-brand align-middle" /> ขาไป
              <span className="ml-3 mr-1 inline-block h-0 w-5 border-t-2 border-dashed border-secondary align-middle" />{" "}
              ขากลับ
            </p>
            <p>หมุดตัวเลข = จุดแวะตามแผน · A ต้นทาง · B ปลายทาง</p>
          </div>

          {draft.routeStyle === "custom" && (
            <div className="space-y-2 border-t-[1.5px] border-dashed border-border pt-2">
              <p className="font-bold">ลากเส้นทางเอง</p>
              <p className="text-xs text-muted">
                แตะแผนที่เพื่อเพิ่มจุดผ่านตามลำดับ · ลากหมุดส้มเพื่อย้าย · แตะหมุดเพื่อลบ
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="mini"
                  disabled={!history.past.length}
                  onClick={() => {
                    const prev = history.past[history.past.length - 1];
                    setHistory({
                      past: history.past.slice(0, -1),
                      future: [points, ...history.future],
                    });
                    onWaypointsChange(prev);
                  }}
                >
                  <Undo2 className="size-3.5" aria-hidden="true" /> ย้อนกลับ
                </Button>
                <Button
                  variant="mini"
                  disabled={!history.future.length}
                  onClick={() => {
                    const [next, ...rest] = history.future;
                    setHistory({ past: [...history.past, points], future: rest });
                    onWaypointsChange(next);
                  }}
                >
                  <Redo2 className="size-3.5" aria-hidden="true" /> ทำซ้ำ
                </Button>
                <Button variant="danger" disabled={!points.length} onClick={() => setPoints([])}>
                  <Trash2 className="size-3.5" aria-hidden="true" /> ล้าง ({points.length})
                </Button>
              </div>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => run({ ...draft, customWaypoints: points })}
              >
                <RefreshCw className="size-4" aria-hidden="true" /> คำนวณเส้นทางใหม่
              </Button>
            </div>
          )}

          <a
            href={googleMapsUrl(draft, plan)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-foreground bg-foreground px-4 text-sm font-bold text-background"
          >
            <ExternalLink className="size-4" aria-hidden="true" /> เปิดเส้นทางใน Google Maps
          </a>
        </aside>
      </div>

      {plan.waypoints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs">
          <span className="text-subtle">ผ่าน:</span>
          {plan.waypoints.map((w, i) => (
            <span
              key={`${w.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-surface px-2.5 py-0.5 font-semibold"
            >
              <b className="font-mono text-accent">{i + 1}</b> {w.name}
              {w.isSecondaryCity && <Badge tone="brand">เมืองรอง</Badge>}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-2">
        {plan.notes.map((n) => (
          <Callout key={n} tone="info">
            {n}
          </Callout>
        ))}
      </div>

      <SectionTitle note="แก้ไขได้ในขั้นถัดไป">แผนรายวัน</SectionTitle>
      <DayPlanList days={plan.days} />

      {plan.suggestions.length > 0 && (
        <>
          <SectionTitle note="ภาพประกอบตามหมวด ไม่ใช่ภาพจริง">สถานที่แนะนำเพิ่มเติม</SectionTitle>
          <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {plan.suggestions.map((s) => (
              <li
                key={s.attId}
                className="flex flex-col overflow-hidden rounded-[13px] border-2 border-foreground bg-surface shadow-hard"
              >
                <div className="aspect-[16/10] border-b-2 border-foreground">
                  <CategoryArt
                    group={s.groupKey}
                    seed={s.name}
                    color={groupColors[s.groupKey] ?? "#87889A"}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="text-xs text-secondary">{s.typeLabel}</p>
                  <h3 className="text-sm font-bold leading-snug">{s.name}</h3>
                  <p className="text-xs text-subtle">
                    {[s.district, s.province].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t-[1.5px] border-dashed border-border pt-2 text-xs text-subtle">
                    <span>ห่างเส้นทาง {formatDistance(s.distanceM)}</span>
                    {s.isSecondaryCity && <Badge tone="brand">เมืองรอง</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
