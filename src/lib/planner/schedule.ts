// Turns a route and scored candidates into a day-by-day draft plan.
// Pure functions: no I/O, so they're easy to reason about and test.

import { distanceMeters, pointAtFraction } from "../geo";
import type {
  Candidate,
  DayPlan,
  LodgingType,
  PlanItem,
  PlanPlace,
  RouteLine,
  RoutePoi,
} from "./plan-types";
import { avoidAdjacentSameGroup, needsEasyPace, pickBalanced } from "./scoring";
import type { PlannerDraft } from "./types";

const DAY_START = 8 * 60;
const DAY_END = 19 * 60;
const REST_EVERY_MIN = 150;
export const MEAL_PER_PERSON = 150;
export const LODGING_PRICE: Record<string, number> = {
  hotel: 1200,
  resort: 1800,
  guest_house: 700,
  hostel: 350,
  apartment: 800,
  motel: 500,
};
export const LODGING_TYPE_BY_KIND: Record<string, LodgingType> = {
  hotel: "hotel",
  resort: "resort",
  guest_house: "daily_room",
  hostel: "dorm",
  apartment: "apartment",
  motel: "hourly_room",
};

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export function hhmm(minutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const OSM_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const OSM_DAY_SPEC =
  /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?\s*,?\s*)+)(.*)$/;

/**
 * Weekdays (0 = Sunday) an OSM `opening_hours` value says the place is open, or null when
 * the value doesn't name days. Handles the common "Mo-Fr 08:00-17:00; Sa off" forms only.
 */
function osmOpenDays(value: string): Set<number> | null {
  if (/24\/7/.test(value) || !/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/.test(value)) return null;
  const open = new Set<number>();
  const closed = new Set<number>();
  for (const raw of value.split(";")) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = rule.match(OSM_DAY_SPEC);
    if (!m) {
      // Times without days apply to every day.
      for (let d = 0; d < 7; d++) open.add(d);
      continue;
    }
    const days = new Set<number>();
    for (const part of m[1].split(",")) {
      const [from, to] = part.trim().split("-");
      const a = OSM_DAYS.indexOf(from);
      if (a < 0) continue;
      const b = to ? OSM_DAYS.indexOf(to) : a;
      for (let i = 0; i < 7; i++) {
        const d = (a + i) % 7;
        days.add(d);
        if (d === b) break;
      }
    }
    const target = /\b(off|closed)\b/i.test(m[2]) ? closed : open;
    days.forEach((d) => target.add(d));
  }
  closed.forEach((d) => open.delete(d));
  return open;
}

/** Warning when the hours say the place is closed on that date's weekday (Thai text or OSM format). */
export function closedWarning(openingHours: string | null, date: string): string | null {
  if (!openingHours) return null;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const day = THAI_DAYS[weekday];
  const text = openingHours.replace(/\s+/g, "");
  const re = new RegExp(`(ปิด|หยุด)[^,;.]{0,12}${day}`);
  if (re.test(text)) return `อาจปิดวัน${day} ตรวจสอบก่อนไป`;
  const openDays = osmOpenDays(openingHours);
  return openDays && !openDays.has(weekday)
    ? `ปิดวัน${day}ตามเวลาเปิดในแผนที่ ตรวจสอบก่อนไป`
    : null;
}

function visitMinutes(effort: number, easy: boolean) {
  const base = effort === 2 ? 120 : effort === 1 ? 90 : 60;
  return easy ? base + 15 : base;
}

export function travellers(d: PlannerDraft) {
  return d.travelers.adults + d.travelers.children + d.travelers.seniors;
}

export function admissionFor(c: Pick<Candidate, "feeTh" | "feeThKid">, d: PlannerDraft) {
  const adult = c.feeTh ?? 0;
  const kid = c.feeThKid ?? adult;
  return adult * (d.travelers.adults + d.travelers.seniors) + kid * d.travelers.children;
}

function placeFromCandidate(c: Candidate): PlanPlace {
  return {
    source: "attraction",
    id: c.attId,
    name: c.name,
    area: [c.district, c.province].filter(Boolean).join(" · ") || null,
    latitude: c.latitude,
    longitude: c.longitude,
    category: c.groupKey,
    isSecondaryCity: c.isSecondaryCity,
  };
}

export function placeFromPoi(p: RoutePoi): PlanPlace {
  return {
    source: "poi",
    id: p.id,
    name: p.name ?? p.brand ?? "ไม่มีชื่อในแผนที่",
    area: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    category: p.kind,
  };
}

export function newItem(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "activity">,
): PlanItem {
  return {
    id: crypto.randomUUID(),
    start: null,
    end: null,
    place: null,
    costEstimate: null,
    costCategory: null,
    phone: null,
    openingHours: null,
    notes: null,
    warning: null,
    lodging: null,
    ...partial,
  };
}

function visitItem(
  c: Candidate,
  start: number,
  d: PlannerDraft,
  date: string,
  easy: boolean,
): PlanItem {
  const fee = admissionFor(c, d);
  return newItem({
    kind: "attraction",
    activity: `เที่ยว ${c.typeLabel ?? "แหล่งท่องเที่ยว"}`,
    start: hhmm(start),
    end: hhmm(start + visitMinutes(c.effort, easy)),
    place: placeFromCandidate(c),
    costEstimate: fee || null,
    costCategory: fee ? "admission" : null,
    phone: c.phone,
    openingHours: c.openingHours,
    warning: closedWarning(c.openingHours, date),
  });
}

function nearestPoi(
  pois: RoutePoi[],
  kinds: string[],
  at: { latitude: number; longitude: number },
  used: Set<string>,
) {
  let best: RoutePoi | null = null;
  let bestD = Infinity;
  for (const p of pois) {
    if (!kinds.includes(p.kind) || used.has(p.id)) continue;
    // Prefer named places: an unnamed one counts as 2 km further away.
    const d = distanceMeters(at, p) + (p.name ? 0 : 2000);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best && bestD < 25000 ? best : null;
}

function mealItem(label: string, start: number, poi: RoutePoi | null, d: PlannerDraft): PlanItem {
  return newItem({
    kind: "meal",
    activity: label,
    start: hhmm(start),
    end: hhmm(start + 60),
    place: poi ? placeFromPoi(poi) : null,
    costEstimate: MEAL_PER_PERSON * travellers(d),
    costCategory: "food",
    phone: poi?.phone ?? null,
    openingHours: poi?.openingHours ?? null,
    notes: poi ? null : "ยังไม่พบร้านในข้อมูล OSM ใกล้จุดนี้ ค้นหาร้านเองได้",
  });
}

function lodgingItem(poi: RoutePoi | null, start: number, d: PlannerDraft): PlanItem {
  const kind = poi?.kind ?? "hotel";
  const rooms = Math.max(1, Math.ceil(travellers(d) / 2));
  const price = (LODGING_PRICE[kind] ?? 1000) * rooms;
  return newItem({
    kind: "lodging",
    activity: "เข้าที่พัก",
    start: hhmm(start),
    end: null,
    place: poi ? placeFromPoi(poi) : null,
    costEstimate: price,
    costCategory: "lodging",
    phone: poi?.phone ?? null,
    notes: poi
      ? `ประมาณ ${rooms} ห้อง ราคาจริงตรวจสอบจากเว็บจองอีกครั้ง`
      : "เลือกที่พักเองในแผนรายวัน",
    lodging: {
      type: LODGING_TYPE_BY_KIND[kind] ?? "hotel",
      minPrice: null,
      maxPrice: null,
      filters: ["parking"],
      prices: {},
      platform: null,
      website: null,
      stars: poi?.stars ?? null,
    },
  });
}

function driveItem(
  fromLabel: string,
  toLabel: string,
  start: number,
  minutes: number,
  km: number,
): PlanItem {
  return newItem({
    kind: "drive",
    activity: `ขับรถ ${fromLabel} → ${toLabel}`,
    start: hhmm(start),
    end: hhmm(start + minutes),
    driveKm: Math.round(km),
  });
}

const LUNCH_AT = 12 * 60;

type Clock = {
  day: DayPlan;
  clock: number;
  drivenSinceRest: number;
  lunchDone: boolean;
  lastLabel: string;
};

type DriveContext = {
  draft: PlannerDraft;
  pois: RoutePoi[];
  usedPoi: Set<string>;
};

function takePoi(ctx: DriveContext, kinds: string[], at: { latitude: number; longitude: number }) {
  const poi = nearestPoi(ctx.pois, kinds, at, ctx.usedPoi);
  if (poi) ctx.usedPoi.add(poi.id);
  return poi;
}

function lunchHere(ctx: DriveContext, t: Clock, at: { latitude: number; longitude: number }) {
  const shop = takePoi(ctx, ["restaurant", "cafe"], at);
  const start = Math.max(t.clock, LUNCH_AT);
  t.day.items.push(mealItem("อาหารกลางวัน", start, shop, ctx.draft));
  t.clock = start + 60;
  t.lunchDone = true;
  t.drivenSinceRest = 0;
  t.lastLabel = shop?.name ?? "จุดทานอาหาร";
}

/**
 * Drives along `line` from fraction `from` to `to` (minutes = share of `totalMin`), splitting
 * the drive for a rest/fuel stop every ~2.5 h and for lunch when it's due.
 */
function driveAlong(
  ctx: DriveContext,
  t: Clock,
  line: RouteLine,
  totalMin: number,
  from: number,
  to: number,
  toLabel: string,
  extraMin = 0,
) {
  let fraction = from;
  let remaining = Math.max(0, (to - from) * totalMin) + extraMin;
  while (remaining > 0.5) {
    const here = pointAtFraction(line.coordinates, fraction);
    if (!t.lunchDone && t.clock >= LUNCH_AT - 15) {
      lunchHere(ctx, t, here);
      continue;
    }
    const toRest = REST_EVERY_MIN - t.drivenSinceRest;
    const toLunch = t.lunchDone ? Infinity : Math.max(15, LUNCH_AT - t.clock);
    let chunk = Math.min(remaining, toRest, toLunch);
    // Don't stop for a rest just before arriving anyway.
    if (chunk === toRest && chunk < toLunch && remaining - chunk < 30) chunk = remaining;
    const chunkF = Math.min(to, fraction + chunk / totalMin);
    const km = (chunk / totalMin) * line.distanceKm;
    if (chunk >= remaining - 0.5) {
      t.day.items.push(driveItem(t.lastLabel, toLabel, t.clock, chunk, km));
      t.clock += chunk;
      t.drivenSinceRest += chunk;
      t.lastLabel = toLabel;
      return;
    }
    const at = pointAtFraction(line.coordinates, chunkF);
    if (chunk === toRest) {
      const rest = takePoi(ctx, ["fuel", "rest_area", "services"], at);
      const restLabel =
        rest?.name ?? rest?.brand ?? (rest?.kind === "fuel" ? "ปั๊มน้ำมัน" : "จุดพักรถ");
      if (chunk > 0.5) t.day.items.push(driveItem(t.lastLabel, restLabel, t.clock, chunk, km));
      t.clock += chunk;
      t.day.items.push(
        newItem({
          kind: "rest_stop",
          activity: "แวะพัก เติมน้ำมัน เข้าห้องน้ำ",
          start: hhmm(t.clock),
          end: hhmm(t.clock + 20),
          place: rest ? placeFromPoi(rest) : null,
          openingHours: rest?.openingHours ?? null,
        }),
      );
      t.clock += 20;
      t.drivenSinceRest = 0;
      t.lastLabel = restLabel;
    } else {
      // Lunch is due partway: drive to a place to eat near here.
      t.day.items.push(driveItem(t.lastLabel, "มื้อกลางวัน", t.clock, chunk, km));
      t.clock += chunk;
      lunchHere(ctx, t, at);
    }
    fraction = chunkF;
    remaining -= chunk;
  }
}

export type ScheduleInput = {
  draft: PlannerDraft;
  dates: string[];
  outbound: RouteLine;
  inbound: RouteLine | null;
  speedFactor: number;
  routeCandidates: Candidate[];
  destinationCandidates: Candidate[];
  routePois: RoutePoi[];
  destinationPois: RoutePoi[];
};

/** Builds the day-by-day draft. Kept deliberately simple; users edit everything afterwards. */
export function buildSchedule(input: ScheduleInput): DayPlan[] {
  const { draft, dates, outbound, inbound, speedFactor } = input;
  const easy = needsEasyPace(draft);
  const dailyDriveLimit = easy || draft.travelers.children > 0 ? 6 * 60 : 8 * 60;
  const used = new Set<string>();
  const usedPoi = new Set<string>();
  const days: DayPlan[] = dates.map((date, index) => ({
    index,
    date,
    title: `วันที่ ${index + 1}`,
    items: [],
    finished: false,
  }));
  const origin = draft.origin!;
  const dest = draft.destination!;
  const allPois = [...input.routePois, ...input.destinationPois];
  const lodgingKinds = ["hotel", "resort", "guest_house", "hostel", "apartment", "motel"];

  const ctx: DriveContext = { draft, pois: allPois, usedPoi };

  // ---- Outbound: drive toward the destination, stopping at the best places along the way.
  const outDrive = outbound.durationMin * speedFactor;
  const returnDay = inbound && days.length >= 2 ? days.length - 1 : -1;
  const outboundDays = Math.min(
    Math.max(1, Math.ceil(outDrive / dailyDriveLimit)),
    Math.max(1, days.length - (returnDay >= 0 ? 1 : 0)),
  );
  const stopsPerDay = easy ? 2 : 3;
  const along = pickBalanced(
    input.routeCandidates.filter(
      (c) => c.routeFraction != null && c.routeFraction > 0.04 && c.routeFraction < 0.97,
    ),
    stopsPerDay * outboundDays * 2,
    draft.balanced,
  );

  let fraction = 0;
  for (let dayIdx = 0; dayIdx < outboundDays; dayIdx++) {
    const day = days[dayIdx];
    const endFraction =
      dayIdx === outboundDays - 1 ? 1 : ((dayIdx + 1) * dailyDriveLimit) / outDrive;
    const arrives = endFraction >= 1;
    day.title =
      dayIdx === 0
        ? `ออกเดินทาง ${origin.label} → ${arrives ? dest.label : "ระหว่างทาง"}`
        : `เดินทางต่อ → ${arrives ? dest.label : "ระหว่างทาง"}`;
    const t: Clock = {
      day,
      clock: DAY_START,
      drivenSinceRest: 0,
      lunchDone: false,
      lastLabel: dayIdx === 0 ? origin.label : "ที่พัก",
    };

    // Only as many stops as fit before the day ends (drive + rests + lunch + dinner).
    const driveToday = (endFraction - fraction) * outDrive;
    const restsToday = Math.floor(driveToday / REST_EVERY_MIN);
    const spare = DAY_END - DAY_START - driveToday - restsToday * 20 - 60;
    const perStop = visitMinutes(1, easy) + 10;
    const maxStops = Math.max(0, Math.min(stopsPerDay, Math.round(spare / perStop)));
    const todays = along
      .filter(
        (c) =>
          !used.has(c.attId) &&
          (c.routeFraction ?? 0) > fraction &&
          (c.routeFraction ?? 0) <= endFraction,
      )
      .slice(0, maxStops)
      .sort((a, b) => (a.routeFraction ?? 0) - (b.routeFraction ?? 0));

    for (const c of todays) {
      const f = c.routeFraction ?? fraction;
      driveAlong(ctx, t, outbound, outDrive, fraction, f, c.name, 10);
      fraction = f;
      if (!t.lunchDone && t.clock >= LUNCH_AT - 15) lunchHere(ctx, t, c);
      used.add(c.attId);
      day.items.push(visitItem(c, t.clock, draft, day.date, easy));
      t.clock += visitMinutes(c.effort, easy);
      t.drivenSinceRest = 0;
      t.lastLabel = c.name;
    }
    driveAlong(
      ctx,
      t,
      outbound,
      outDrive,
      fraction,
      endFraction,
      arrives ? dest.label : "จุดค้างคืน",
    );
    fraction = endFraction;

    if (dayIdx === 0 && outDrive > dailyDriveLimit * outboundDays && day.items[0]) {
      day.items[0].warning = `ขับรวมประมาณ ${Math.round(outDrive / 60)} ชม. นานเกินไปสำหรับจำนวนวันนี้ ลองเพิ่มวันเดินทาง`;
    }

    // Overnight, unless this is the trip's last day.
    if (dayIdx < days.length - 1) {
      const at = pointAtFraction(outbound.coordinates, Math.min(1, endFraction));
      const dinnerShop = takePoi(ctx, ["restaurant"], at);
      day.items.push(mealItem("อาหารเย็น", Math.max(t.clock, 18 * 60), dinnerShop, draft));
      const stay = takePoi(ctx, lodgingKinds, at);
      day.items.push(lodgingItem(stay, Math.max(t.clock, 18 * 60) + 60, draft));
    }
  }

  // ---- Days at the destination.
  const stayDays = days.filter((_, i) => i >= outboundDays && i !== returnDay);
  const nearDest = pickBalanced(
    input.destinationCandidates.filter((c) => !used.has(c.attId)),
    stayDays.length * (easy ? 3 : 4),
    draft.balanced,
  );
  let pool = [...nearDest];
  for (const day of stayDays) {
    day.title = `เที่ยวรอบ ${dest.label}`;
    let here = { latitude: dest.latitude, longitude: dest.longitude };
    let clock = DAY_START + 30;
    let lunchDone = false;
    const todays: Candidate[] = [];
    // Nearest-neighbour order keeps the day's driving short.
    for (let n = 0; n < (easy ? 3 : 4) && pool.length; n++) {
      pool.sort((a, b) => distanceMeters(here, a) - distanceMeters(here, b));
      const next = pool.shift()!;
      todays.push(next);
      here = next;
    }
    let from = { latitude: dest.latitude, longitude: dest.longitude, label: "ที่พัก" };
    for (const c of avoidAdjacentSameGroup(todays)) {
      const km = (distanceMeters(from, c) / 1000) * 1.3;
      const minutes = Math.max(10, (km / 40) * 60 * speedFactor);
      if (!lunchDone && clock + minutes >= 12 * 60) {
        const shop = nearestPoi(allPois, ["restaurant", "cafe"], from, usedPoi);
        if (shop) usedPoi.add(shop.id);
        day.items.push(mealItem("อาหารกลางวัน", Math.max(clock, 12 * 60), shop, draft));
        clock = Math.max(clock, 12 * 60) + 60;
        lunchDone = true;
      }
      day.items.push(driveItem(from.label, c.name, clock, minutes, km));
      clock += minutes;
      used.add(c.attId);
      day.items.push(visitItem(c, clock, draft, day.date, easy));
      clock += visitMinutes(c.effort, easy);
      from = { latitude: c.latitude, longitude: c.longitude, label: c.name };
      if (clock > DAY_END - 60) break;
    }
    const dinnerShop = nearestPoi(allPois, ["restaurant"], dest, usedPoi);
    if (dinnerShop) usedPoi.add(dinnerShop.id);
    day.items.push(mealItem("อาหารเย็น", Math.max(clock, 18 * 60), dinnerShop, draft));
    // The last day of a one-way trip ends at the destination: no night to book.
    if (day.index < days.length - 1) {
      const stay = nearestPoi(allPois, lodgingKinds, dest, usedPoi);
      if (stay) usedPoi.add(stay.id);
      day.items.push(lodgingItem(stay, Math.max(clock, 18 * 60) + 60, draft));
    }
    pool = pool.filter((c) => !used.has(c.attId));
  }

  // ---- Return day.
  if (returnDay >= 0 && inbound) {
    const day = days[returnDay];
    day.title = `เดินทางกลับ ${dest.label} → ${origin.label}`;
    const inDrive = inbound.durationMin * speedFactor;
    const t: Clock = {
      day,
      clock: 9 * 60,
      drivenSinceRest: 0,
      lunchDone: false,
      lastLabel: "ที่พัก",
    };
    driveAlong(ctx, t, inbound, inDrive, 0, 1, origin.label);
    if (inDrive > dailyDriveLimit && day.items[0]) {
      day.items[0].warning = `ขับกลับรวมประมาณ ${Math.round(inDrive / 60)} ชม. นานกว่าที่ควรขับต่อวัน ลองเพิ่มวันพักระหว่างทาง`;
    }
  }

  return days;
}
