"use client";

import {
  CalendarCheck,
  ExternalLink,
  ListOrdered,
  Loader2,
  Plus,
  RefreshCw,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CategoryArt } from "@/components/category-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { SectionTitle } from "@/components/ui/section-title";
import { StatTile } from "@/components/ui/stat-tile";
import { Toggle } from "@/components/ui/toggle";
import {
  formatDistance,
  formatDuration,
  snapWaypointToRoute,
  sortWaypointsAlongRoute,
} from "@/lib/geo";
import { FUEL_TYPES } from "@/lib/fuel";
import { saveLocalTrip } from "@/lib/local-trips";
import { poiKindLabel } from "@/lib/places";
import {
  closestDay,
  COST_CATEGORY_FOR_KIND,
  costTotals,
  lodgingFor,
  orderTripItems,
} from "@/lib/planner/edit";
import { POI_CATEGORIES, poiCategoryOf } from "@/lib/planner/poi-categories";
import type { Candidate, PlanItem, RoutePoi, TripPlan } from "@/lib/planner/plan-types";
import { admissionFor, closedWarning, newItem } from "@/lib/planner/schedule";
import type { LatLng, PlaceGroupOption, PlannerDraft, RouteStyle } from "@/lib/planner/types";
import { BookingChecklist } from "./booking-checklist";
import { CostSummary } from "./cost-summary";
import { baht } from "./day-plan";
import { DayEditor, type AddRequest } from "./day-editor";
import { buildAssistantContext } from "@/lib/assistant/context";
import { saveTrip } from "./editor-actions";
import { PlanOptions } from "./plan-options";
import type { FailedOption, PlanOption } from "./use-saved-plan";

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

function itemFromPoi(p: RoutePoi, date: string): PlanItem {
  const category = COST_CATEGORY_FOR_KIND[p.kind] ?? null;
  return newItem({
    kind: category === "lodging" ? "lodging" : category === "food" ? "meal" : "poi",
    activity: `แวะ${poiKindLabel(p.kind)}`,
    place: {
      source: "poi",
      id: p.id,
      name: p.name ?? p.brand ?? poiKindLabel(p.kind),
      area: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      category: p.kind,
    },
    phone: p.phone,
    openingHours: p.openingHours,
    warning: closedWarning(p.openingHours, date),
    costCategory: category,
    lodging: category === "lodging" ? lodgingFor(p.kind, p) : null,
  });
}

function itemFromCandidate(c: Candidate, date: string, draft: PlannerDraft): PlanItem {
  const fee = admissionFor(c, draft);
  return newItem({
    kind: "attraction",
    activity: `เที่ยว ${c.typeLabel ?? "แหล่งท่องเที่ยว"}`,
    place: {
      source: "attraction",
      id: c.attId,
      name: c.name,
      area: [c.district, c.province].filter(Boolean).join(" · ") || null,
      latitude: c.latitude,
      longitude: c.longitude,
      category: c.groupKey,
      isSecondaryCity: c.isSecondaryCity,
    },
    phone: c.phone,
    openingHours: c.openingHours,
    warning: closedWarning(c.openingHours, date),
    costEstimate: fee || null,
    costCategory: fee ? "admission" : null,
  });
}

export function PlanLoading({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div
      className="rounded-card border-2 border-foreground bg-surface p-6 shadow-hard"
      aria-live="polite"
    >
      {error ? (
        <Callout tone="danger" title="ร่างแผนไม่สำเร็จ">
          {error}
          <div className="mt-2">
            <Button variant="mini" onClick={onRetry}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> ลองใหม่
            </Button>
          </div>
        </Callout>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          กำลังร่างหลายแบบเส้นทางให้เทียบ: คำนวณเส้นทาง เลือกจุดแวะ และจัดตารางรายวัน…
        </p>
      )}
    </div>
  );
}

export function PlanResult({
  draft,
  plan,
  groups,
  pending,
  error,
  waypoints,
  onWaypointsChange,
  onRecalculate,
  onPlanChange,
  tripId,
  onSaved,
  addRequest,
  onAddRequest,
  options = [],
  failed = [],
  onChoose,
}: {
  /** The answers the plan was drafted from. */
  draft: PlannerDraft;
  plan: TripPlan;
  groups: PlaceGroupOption[];
  pending: boolean;
  error: string | null;
  /** Live custom-route points (edited on the map before recalculating). */
  waypoints: LatLng[];
  onWaypointsChange: (points: LatLng[]) => void;
  onRecalculate: (points: LatLng[]) => void;
  onPlanChange: (plan: TripPlan) => void;
  tripId: string | null;
  onSaved: (tripId: string) => void;
  /** Pending "add to daily plan" (from the map, suggestions or the AI assistant). */
  addRequest: AddRequest | null;
  onAddRequest: (request: AddRequest | null) => void;
  /** Other route styles drafted in the same run, for comparison. */
  options?: PlanOption[];
  failed?: FailedOption[];
  onChoose?: (style: RouteStyle) => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState<string[]>(() =>
    POI_CATEGORIES.map((c) => c.key).filter((k) => k !== "other"),
  );
  // Custom route editing with undo/redo.
  const [history, setHistory] = useState<{ past: LatLng[][]; future: LatLng[][] }>({
    past: [],
    future: [],
  });
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [snapRoad, setSnapRoad] = useState(true);
  const [snapMessage, setSnapMessage] = useState<string | null>(null);

  // The planner answers as text (no plan detail), for the AI route advice.
  const tripSummary = useMemo(
    () => buildAssistantContext(draft, null, groups).summary.replace(/\n\nยังไม่ได้กดร่างแผน$/, ""),
    [draft, groups],
  );
  const groupColors = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.key, g.color])),
    [groups],
  );
  const stops = useMemo(() => {
    let n = 0;
    return plan.days.flatMap((day) =>
      day.items
        .filter((i) => i.kind === "attraction" && i.place)
        .map((i) => ({ place: i.place!, day: day.index, label: String(++n) })),
    );
  }, [plan]);
  const poiCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plan.pois)
      counts[poiCategoryOf(p.kind).key] = (counts[poiCategoryOf(p.kind).key] ?? 0) + 1;
    return counts;
  }, [plan]);

  const points = waypoints;
  const setPoints = (next: LatLng[]) => {
    setHistory((h) => ({ past: [...h.past, points], future: [] }));
    onWaypointsChange(next);
  };

  const preparePoint = (point: LatLng) => {
    if (!snapRoad) return point;
    const snapped = snapWaypointToRoute(point, plan.outbound.coordinates);
    setSnapMessage(`เกาะเส้นทางแล้ว · ขยับ ${snapped.distanceM.toLocaleString("th-TH")} ม.`);
    return snapped.point;
  };

  /** Opens the add form on the day whose places are closest to this spot. */
  const requestAdd = (
    at: { latitude: number; longitude: number },
    make: (date: string) => PlanItem,
  ) => {
    const dayIndex = closestDay(plan, at);
    const date = plan.days.find((d) => d.index === dayIndex)?.date ?? plan.days[0].date;
    onAddRequest({ key: Date.now(), dayIndex, item: make(date) });
  };

  const save = () =>
    startSaving(async () => {
      const orderedPlan = orderTripItems(plan);
      const res = await saveTrip(draft, orderedPlan);
      if ("needLogin" in res) {
        // The plan stays in this browser; signing in brings the user back here.
        router.push(`/login?next=${encodeURIComponent("/plan?resume=1")}`);
      } else if ("error" in res) {
        setSaveError(res.error);
      } else {
        setSaveError(null);
        saveLocalTrip({ id: res.id, savedAt: new Date().toISOString(), draft, plan: orderedPlan });
        onSaved(res.id);
        router.push("/trips");
      }
    });

  const unit = FUEL_TYPES.find((f) => f.key === draft.vehicle.fuel)?.unit ?? "ลิตร";
  const totalCost = costTotals(plan).total;
  const tripDays = plan.days.length;

  return (
    <div className="space-y-2" aria-busy={pending}>
      <SectionTitle note="คำนวณจากรถ เวลาออกเดินทาง และพิกัดจริงของทุกจุด">
        ร่างแผนการเดินทาง
      </SectionTitle>

      {onChoose && options.length + failed.length > 1 && (
        <PlanOptions
          // A new drafting run starts with fresh AI advice.
          key={options.map((o) => `${o.style}:${Math.round(o.plan.totals.distanceKm)}`).join("|")}
          options={options}
          failed={failed}
          chosen={draft.routeStyle}
          currentPlan={plan}
          tripSummary={tripSummary}
          onChoose={onChoose}
        />
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          value={`${Math.round(plan.totals.distanceKm).toLocaleString("th-TH")} กม.`}
          label={plan.inbound ? "ระยะทางรวม (ไป-กลับ)" : "ระยะทาง (ขาไปอย่างเดียว)"}
        />
        <StatTile value={formatDuration(plan.totals.driveMin)} label="เวลาขับรวม ไม่รวมแวะ" />
        <StatTile value={`${tripDays} วัน ${Math.max(0, tripDays - 1)} คืน`} label="ระยะเวลาทริป" />
        <StatTile value={stops.length} label="จุดแวะเที่ยวในแผน" />
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
            onAddPoi={(p) => requestAdd(p, (date) => itemFromPoi(p, date))}
            altRoutes={options
              .filter((o) => o.style !== draft.routeStyle)
              .map((o) => o.plan.outbound.coordinates)}
            editing={
              draft.routeStyle === "custom"
                ? {
                    points,
                    onAdd: (p) => setPoints([...points, preparePoint(p)].slice(0, 15)),
                    onMove: (i, p) => {
                      const next = preparePoint(p);
                      setPoints(points.map((q, k) => (k === i ? next : q)));
                    },
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
              {plan.inbound && (
                <>
                  <span className="ml-3 mr-1 inline-block h-0 w-5 border-t-2 border-dashed border-secondary align-middle" />{" "}
                  ขากลับ
                </>
              )}
            </p>
            <p>หมุดตัวเลข = จุดแวะตามแผน · A ต้นทาง · B ปลายทาง</p>
          </div>

          {draft.routeStyle === "custom" && (
            <div className="space-y-2 border-t-[1.5px] border-dashed border-border pt-2">
              <p className="font-bold">ลากเส้นทางเอง</p>
              <p className="text-xs text-muted">
                แตะแผนที่เพื่อเพิ่มจุดผ่านตามลำดับ · ลากหมุดส้มเพื่อย้าย · แตะหมุดเพื่อลบ
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-2.5">
                <div>
                  <p className="text-xs font-bold">เกาะถนนอัตโนมัติ</p>
                  <p className="text-[11px] text-subtle">
                    ยึดกับเส้นถนนที่คำนวณอยู่ โดยไม่ส่งพิกัดออกเพิ่ม
                  </p>
                </div>
                <Toggle
                  label="เกาะถนนอัตโนมัติ"
                  hideLabel
                  checked={snapRoad}
                  onChange={setSnapRoad}
                />
              </div>
              {snapMessage && <p className="text-xs text-subtle">{snapMessage}</p>}
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
                <Button
                  variant="mini"
                  disabled={points.length < 2}
                  onClick={() =>
                    setPoints(sortWaypointsAlongRoute(points, plan.outbound.coordinates))
                  }
                >
                  <ListOrdered className="size-3.5" aria-hidden="true" /> เรียง waypoint
                </Button>
              </div>
              <Button className="w-full" disabled={pending} onClick={() => onRecalculate(points)}>
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

      <SectionTitle note="กด + เพื่อเพิ่มกิจกรรม แก้ไข เปลี่ยนแผน หรือเลือกที่พัก แล้วกดจบกิจกรรมทีละวัน">
        แผนรายวัน
      </SectionTitle>
      <DayEditor
        draft={draft}
        plan={plan}
        onChange={onPlanChange}
        addRequest={addRequest}
        onAddRequestDone={() => onAddRequest(null)}
      />

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
                  <Button
                    variant="mini"
                    className="mt-1"
                    onClick={() => requestAdd(s, (date) => itemFromCandidate(s, date, draft))}
                  >
                    <Plus className="size-3.5" aria-hidden="true" /> เพิ่มลงแผนรายวัน
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle note="รวมค่าน้ำมันจากระยะทาง และค่าใช้จ่ายทุกรายการในแผนรายวัน">
        สรุปค่าใช้จ่าย
      </SectionTitle>
      <CostSummary draft={draft} plan={plan} />

      <SectionTitle note="จองทีละคืน กลับมาที่หน้านี้แล้วระบบจะถามต่อให้ ไม่ต้องเริ่มใหม่">
        Checklist การจองที่พัก
      </SectionTitle>
      <BookingChecklist draft={draft} plan={plan} onChange={onPlanChange} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-foreground bg-surface-3 px-4 py-4 shadow-hard">
        <div className="min-w-0 space-y-0.5">
          <p className="font-display text-lg font-bold">
            {tripId ? "บันทึกเป็นแผนของฉันแล้ว" : "พร้อมออกเดินทางแล้วหรือยัง?"}
          </p>
          <p className="text-xs text-subtle">
            {tripId ? (
              <>
                ดูได้ที่{" "}
                <Link href="/trips" className="font-semibold text-info underline">
                  แผนของฉัน
                </Link>{" "}
                · ถ้าแก้แผนแล้วกดบันทึกอีกครั้ง จะได้เป็นแผนใหม่
              </>
            ) : (
              "บันทึกลงแผนของฉันเพื่อดูทริปที่จะถึง และกดเริ่มแผนพร้อม GPS เมื่อถึงวันเดินทาง (ต้องเข้าสู่ระบบ)"
            )}
          </p>
          {saveError && <p className="text-xs font-semibold text-danger">{saveError}</p>}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <CalendarCheck className="size-4" aria-hidden="true" />
          )}
          {tripId ? "บันทึกอีกครั้ง" : "สร้างแผนของฉัน"}
        </Button>
      </div>
    </div>
  );
}
