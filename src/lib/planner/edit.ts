// Small pure helpers for editing a drafted plan in the browser.

import { distanceMeters } from "../geo";
import type { CostCategory, DayPlan, PlanItem, PlanPlace, TripPlan } from "./plan-types";
import { hhmm } from "./schedule";

export function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function addMinutes(time: string, minutes: number) {
  return hhmm((minutesOf(time) ?? 0) + minutes);
}

/** Puts a timed item before the first later item; untimed items go last. */
export function insertByTime(items: PlanItem[], item: PlanItem, afterIndex?: number): PlanItem[] {
  if (afterIndex != null)
    return [...items.slice(0, afterIndex + 1), item, ...items.slice(afterIndex + 1)];
  const t = minutesOf(item.start);
  if (t == null) return [...items, item];
  const at = items.findIndex((i) => {
    const s = minutesOf(i.start);
    return s != null && s > t;
  });
  return at < 0 ? [...items, item] : [...items.slice(0, at), item, ...items.slice(at)];
}

export function updateDay(
  plan: TripPlan,
  dayIndex: number,
  fn: (day: DayPlan) => DayPlan,
): TripPlan {
  return { ...plan, days: plan.days.map((d) => (d.index === dayIndex ? fn(d) : d)) };
}

export function replaceItem(day: DayPlan, item: PlanItem): DayPlan {
  return { ...day, items: day.items.map((i) => (i.id === item.id ? item : i)) };
}

export function moveItem(day: DayPlan, id: string, delta: -1 | 1): DayPlan {
  const i = day.items.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= day.items.length) return day;
  const items = [...day.items];
  [items[i], items[j]] = [items[j], items[i]];
  return { ...day, items };
}

/** The last place on the day at or before `index` (or the day's last place). */
export function placeBefore(day: DayPlan, index = day.items.length - 1): PlanPlace | null {
  for (let i = Math.min(index, day.items.length - 1); i >= 0; i--) {
    const p = day.items[i].place;
    if (p) return p;
  }
  return null;
}

/** When the next thing can start: the end (or start) of the last timed item. */
export function nextStart(day: DayPlan, index = day.items.length - 1): string {
  for (let i = Math.min(index, day.items.length - 1); i >= 0; i--) {
    const it = day.items[i];
    if (it.end) return it.end;
    if (it.start) return it.start;
  }
  return "09:00";
}

/** Start of the first free slot of at least `minutes` between timed items (else after the last). */
export function firstGap(day: DayPlan, minutes = 60): string {
  const timed = day.items.filter((i) => i.start);
  for (let k = 0; k < timed.length - 1; k++) {
    const end = minutesOf(timed[k].end ?? timed[k].start);
    const next = minutesOf(timed[k + 1].start);
    if (end != null && next != null && next - end >= minutes)
      return timed[k].end ?? timed[k].start!;
  }
  return nextStart(day);
}

/** The day whose planned places are closest to a point (for "add to plan" from the map). */
export function closestDay(plan: TripPlan, at: { latitude: number; longitude: number }): number {
  let best = 0;
  let bestD = Infinity;
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.place || item.kind === "lodging") continue;
      const d = distanceMeters(at, item.place);
      if (d < bestD) {
        bestD = d;
        best = day.index;
      }
    }
  }
  return best;
}

export const COST_CATEGORY_FOR_KIND: Record<string, CostCategory | null> = {
  restaurant: "food",
  cafe: "food",
  fuel: "fuel",
  parking: "travel",
  hotel: "lodging",
  resort: "lodging",
  guest_house: "lodging",
  hostel: "lodging",
  apartment: "lodging",
  motel: "lodging",
  museum: "admission",
};

/** Cost totals by category; fuel includes the route's estimated fuel. */
export function costTotals(plan: TripPlan) {
  const totals: Record<CostCategory, number> = {
    fuel: plan.totals.fuelCost,
    travel: 0,
    admission: 0,
    food: 0,
    lodging: 0,
    other: 0,
  };
  for (const day of plan.days) {
    for (const item of day.items) {
      // A booked stay counts at the price actually paid.
      const booked = item.lodging?.booking?.status === "booked" ? item.lodging.booking.price : null;
      const amount = booked ?? item.costEstimate;
      if (!amount) continue;
      totals[item.costCategory ?? (item.kind === "lodging" ? "lodging" : "other")] += amount;
    }
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  return { totals, total };
}
