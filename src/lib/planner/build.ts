import { simplifyToMax, toGeoJsonLine } from "../geo";
import { roadRoute, type RoadRoute, type RouteProfile } from "../routing";
import { getSupabase } from "../supabase";
import { isoDate } from "./draft";
import type { Candidate, PlanPlace, RouteLine, RoutePoi, TripPlan } from "./plan-types";
import { buildSchedule } from "./schedule";
import { pickBalanced, scoreCandidate } from "./scoring";
import type { LatLng, PlannerDraft, StopKind } from "./types";
import { vehicleEfficiency, vehicleTypeInfo } from "./vehicles";

export const MAX_TRIP_DAYS = 14;

const STOP_KIND_TO_POI: Record<StopKind, string[]> = {
  restaurant: ["restaurant"],
  cafe: ["cafe"],
  lodging: ["hotel", "resort", "guest_house", "hostel", "apartment", "motel"],
  temple: [],
  attraction: ["museum"],
  rest_area: ["rest_area", "services"],
  fuel: ["fuel"],
  toilets: ["toilets"],
  parking: ["parking"],
  atm: ["atm"],
  health: ["pharmacy", "hospital", "clinic"],
  other: [],
};

const SCENIC_GROUPS = ["view", "nature", "mountain", "sea"];
const COMMUNITY_GROUPS = ["local", "market", "farm"];

type CandidateRow = {
  att_id: string;
  att_name_th: string;
  att_name_en: string | null;
  att_type: number;
  group_key: string;
  effort: number;
  att_type_label: string | null;
  province_name_th: string | null;
  district_name_th: string | null;
  is_secondary_city: boolean;
  att_start_end: string | null;
  att_fee_th: number | null;
  att_fee_th_kid: number | null;
  att_tel: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  route_fraction?: number;
};

type PoiRow = {
  osm_id: string;
  kind: string;
  subkind: string | null;
  name: string | null;
  brand: string | null;
  phone: string | null;
  opening_hours: string | null;
  stars: number | null;
  image_url: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  route_fraction?: number;
};

function toCandidate(r: CandidateRow, draft: PlannerDraft): Candidate {
  const c = {
    attId: r.att_id,
    name: r.att_name_th,
    nameEn: r.att_name_en,
    attType: r.att_type,
    groupKey: r.group_key,
    effort: r.effort,
    typeLabel: r.att_type_label,
    province: r.province_name_th,
    district: r.district_name_th,
    isSecondaryCity: r.is_secondary_city,
    openingHours: r.att_start_end,
    feeTh: r.att_fee_th,
    feeThKid: r.att_fee_th_kid,
    phone: r.att_tel,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceM: r.distance_m,
    routeFraction: r.route_fraction ?? null,
  };
  return { ...c, score: scoreCandidate(c, draft) };
}

function toPoi(r: PoiRow): RoutePoi {
  return {
    id: r.osm_id,
    kind: r.kind,
    subkind: r.subkind,
    name: r.name,
    brand: r.brand,
    phone: r.phone,
    openingHours: r.opening_hours,
    stars: r.stars,
    imageUrl: r.image_url,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceM: r.distance_m,
    routeFraction: r.route_fraction ?? 1,
  };
}

/** Route geometry thinned for the browser and for fraction lookups (road shape stays visually the same). */
function lineOf(route: RoadRoute): RouteLine {
  return {
    coordinates: simplifyToMax(route.coordinates, 2000),
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
  };
}

function tripDates(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last && out.length < MAX_TRIP_DAYS) {
    out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Choose up to `count` extra route points for scenic/community styles, spread along the route. */
function spreadWaypoints(cands: Candidate[], count: number): Candidate[] {
  const picked: Candidate[] = [];
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    const f = c.routeFraction ?? 0;
    if (f < 0.08 || f > 0.92) continue;
    if (picked.some((p) => Math.abs((p.routeFraction ?? 0) - f) < 0.12)) continue;
    picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.sort((a, b) => (a.routeFraction ?? 0) - (b.routeFraction ?? 0));
}

export class PlanError extends Error {}

/** Builds the full draft: road route, detours for the chosen style, candidates, POIs, day plan and costs. */
export async function buildTripPlan(draft: PlannerDraft): Promise<TripPlan> {
  const origin = draft.origin;
  const dest = draft.destination;
  if (!origin || !dest) throw new PlanError("กรุณาเลือกต้นทางและปลายทาง");

  const vType = vehicleTypeInfo(draft.vehicle.type);
  const profile: RouteProfile = {
    costing:
      draft.vehicle.type === "motorcycle"
        ? "motorcycle"
        : draft.vehicle.type === "bus"
          ? "bus"
          : "auto",
    avoidHighways: draft.routeStyle === "scenic" || draft.routeStyle === "community",
  };
  const from: LatLng = { lat: origin.latitude, lng: origin.longitude };
  const to: LatLng = { lat: dest.latitude, lng: dest.longitude };
  const custom = draft.routeStyle === "custom" ? draft.customWaypoints.slice(0, 15) : [];

  const base = await roadRoute([from, ...custom, to], profile);
  if (!base) throw new PlanError("คำนวณเส้นทางไม่สำเร็จ ระบบนำทางไม่ตอบ กรุณาลองใหม่อีกครั้ง");

  const db = getSupabase();
  const groupFilter = draft.interests.length ? draft.interests : null;
  let outbound = base;
  const waypoints: PlanPlace[] = custom.map((p, i) => ({
    source: "pin",
    name: `จุดผ่าน ${i + 1}`,
    latitude: p.lat,
    longitude: p.lng,
  }));

  // Scenic / community: route through a few matching places spread along the way.
  if (draft.routeStyle === "scenic" || draft.routeStyle === "community") {
    const groups = draft.routeStyle === "scenic" ? SCENIC_GROUPS : COMMUNITY_GROUPS;
    const { data } = await db.rpc("attractions_along_route", {
      route: toGeoJsonLine(simplifyToMax(base.coordinates, 300)),
      groups,
      buffer_m: 12000,
      max_results: 150,
    });
    const via = spreadWaypoints(
      ((data ?? []) as CandidateRow[]).map((r) => toCandidate(r, draft)),
      4,
    );
    if (via.length) {
      const detour = await roadRoute(
        [from, ...via.map((c) => ({ lat: c.latitude, lng: c.longitude })), to],
        profile,
      );
      if (detour) outbound = detour;
      waypoints.push(
        ...via.map((c) => ({
          source: "attraction" as const,
          id: c.attId,
          name: c.name,
          area: [c.district, c.province].filter(Boolean).join(" · "),
          latitude: c.latitude,
          longitude: c.longitude,
          category: c.groupKey,
          isSecondaryCity: c.isSecondaryCity,
        })),
      );
    }
  }

  const dates = tripDates(draft.startDate, draft.endDate);
  // Coming home: the plain route reversed (no second routing call).
  const baseLine = lineOf(base);
  const inbound: RouteLine | null =
    dates.length >= 2 ? { ...baseLine, coordinates: [...baseLine.coordinates].reverse() } : null;
  const outboundLine = outbound === base ? baseLine : lineOf(outbound);

  const line = toGeoJsonLine(simplifyToMax(outboundLine.coordinates, 300));
  const poiKinds = [...new Set(draft.stopKinds.flatMap((k) => STOP_KIND_TO_POI[k]))];
  // Always need food, fuel and lodging to build the schedule, even if not shown as layers.
  const scheduleKinds = [
    ...new Set([
      ...poiKinds,
      "restaurant",
      "cafe",
      "fuel",
      "rest_area",
      "services",
      "hotel",
      "resort",
      "guest_house",
      "hostel",
      "apartment",
      "motel",
    ]),
  ];
  const [alongRes, poiRes, nearDestRes, destPoiRes] = await Promise.all([
    db.rpc("attractions_along_route", {
      route: line,
      groups: groupFilter,
      buffer_m: 15000,
      max_results: 250,
    }),
    db.rpc("poi_along_route", { route: line, kinds: scheduleKinds, buffer_m: 1500, per_kind: 100 }),
    db.rpc("attractions_near", {
      lat: to.lat,
      lng: to.lng,
      groups: groupFilter,
      radius_m: 40000,
      max_results: 150,
    }),
    db.rpc("nearby_poi", {
      lat: to.lat,
      lng: to.lng,
      kinds: [
        "restaurant",
        "cafe",
        "hotel",
        "resort",
        "guest_house",
        "hostel",
        "apartment",
        "motel",
      ],
      radius_m: 10000,
      max_results: 80,
    }),
  ]);
  for (const r of [alongRes, poiRes, nearDestRes, destPoiRes]) {
    if (r.error) throw new Error(`Failed to load planner data: ${r.error.message}`);
  }

  const routeCandidates = ((alongRes.data ?? []) as CandidateRow[]).map((r) =>
    toCandidate(r, draft),
  );
  const destinationCandidates = ((nearDestRes.data ?? []) as CandidateRow[]).map((r) =>
    toCandidate(r, draft),
  );
  const routePois = ((poiRes.data ?? []) as PoiRow[]).map(toPoi);
  const destinationPois = ((destPoiRes.data ?? []) as PoiRow[]).map(toPoi);

  const days = buildSchedule({
    draft,
    dates,
    outbound: outboundLine,
    inbound,
    speedFactor: vType.speedFactor,
    routeCandidates,
    destinationCandidates,
    routePois,
    destinationPois,
  });

  const planned = new Set(days.flatMap((d) => d.items.map((i) => i.place?.id).filter(Boolean)));
  const suggestions = pickBalanced(
    [...routeCandidates, ...destinationCandidates].filter(
      (c, i, all) => !planned.has(c.attId) && all.findIndex((x) => x.attId === c.attId) === i,
    ),
    24,
    draft.balanced,
  );

  const distanceKm = outbound.distanceKm + (inbound?.distanceKm ?? 0);
  const driveMin = (outbound.durationMin + (inbound?.durationMin ?? 0)) * vType.speedFactor;
  const fuelUnits = distanceKm / vehicleEfficiency(draft.vehicle);
  const admissionCost = days
    .flatMap((d) => d.items)
    .filter((i) => i.costCategory === "admission")
    .reduce((n, i) => n + (i.costEstimate ?? 0), 0);

  const notes = [
    "เวลาเดินทางเป็นค่าประมาณจากข้อมูลถนน OpenStreetMap ไม่รวมสภาพจราจรจริง",
    "ระยะทางรวมนับทั้งขาไปและขากลับ",
  ];
  if (outbound.engine === "osrm") notes.push("ระบบนำทางหลักไม่ตอบ จึงใช้เส้นทางสำรองแบบเร็วที่สุด");
  if (dates.length === MAX_TRIP_DAYS && draft.endDate > dates[dates.length - 1]) {
    notes.push(`จัดตารางให้ ${MAX_TRIP_DAYS} วันแรก`);
  }

  return {
    outbound: outboundLine,
    inbound,
    waypoints,
    days,
    pois: routePois.filter((p) => poiKinds.includes(p.kind)),
    suggestions,
    totals: {
      distanceKm,
      driveMin,
      stops: days.flatMap((d) => d.items).filter((i) => i.kind === "attraction").length,
      fuelUnits,
      fuelCost: fuelUnits * draft.vehicle.fuelPrice,
      admissionCost,
    },
    notes,
    engine: outbound.engine,
  };
}
