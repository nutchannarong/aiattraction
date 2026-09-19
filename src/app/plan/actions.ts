"use server";

import { z } from "zod";
import { toGeoJsonLine } from "@/lib/geo";
import { getPlaceGroups } from "@/lib/place-groups";
import { buildTripPlan, PlanError } from "@/lib/planner/build";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { PlaceGroupOption, PlannerDraft, RouteStyle } from "@/lib/planner/types";
import { getSupabase } from "@/lib/supabase";

const lat = z.number().min(4).max(22);
const lng = z.number().min(96).max(107);

const placeSchema = z.object({ label: z.string().max(200), latitude: lat, longitude: lng }).loose();

// Only the fields the server relies on are checked strictly; the rest passes through.
const draftSchema = z
  .object({
    version: z.literal(1),
    origin: placeSchema,
    destination: placeSchema,
    tripType: z.enum(["round", "one_way"]).optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    travelers: z.object({
      adults: z.int().min(0).max(100),
      children: z.int().min(0).max(100),
      seniors: z.int().min(0).max(100),
      adultAges: z.array(z.enum(["18-22", "23-30", "31-45", "46-59"])).max(4),
    }),
    occasion: z.enum(["couple", "friends", "family", "parents", "solo"]).nullable(),
    interests: z.array(z.string().max(20)).min(1, "เลือกแนวท่องเที่ยวอย่างน้อย 1 แนว").max(13),
    interestTypes: z.array(z.int()).max(100),
    balanced: z.boolean(),
    stopKinds: z.array(z.string().max(20)).min(1, "เลือกประเภทจุดแวะอย่างน้อย 1 แบบ").max(20),
    vehicle: z
      .object({
        type: z.enum(["motorcycle", "eco_car", "sedan", "suv", "pickup", "van", "bus"]),
        fuelPrice: z.number().min(0).max(1000),
        efficiencyOverride: z.number().min(0.1).max(200).nullable(),
        cc: z.number().min(0).max(20000).nullable(),
        year: z.int().min(1950).max(2100).nullable(),
      })
      .loose(),
    routeStyle: z.enum(["fastest", "scenic", "community", "mixed", "custom"]),
    customWaypoints: z.array(z.object({ lat, lng })).max(15),
  })
  .loose()
  .refine((d) => d.endDate >= d.startDate, "วันสุดท้ายของทริปต้องไม่ก่อนวันออกเดินทาง")
  .refine((d) => {
    const start = new Date(`${d.startDate}T00:00:00Z`).getTime();
    const end = new Date(`${d.endDate}T00:00:00Z`).getTime();
    return Math.round((end - start) / 86400000) + 1 <= 14;
  }, "เลือกช่วงเดินทางไม่เกิน 14 วัน")
  .refine(
    (d) => d.travelers.adults + d.travelers.children + d.travelers.seniors > 0,
    "ต้องมีผู้เดินทางอย่างน้อย 1 คน",
  )
  .refine(
    (d) => d.travelers.adults === 0 || d.travelers.adultAges.length > 0,
    "เลือกช่วงวัยของผู้ใหญ่",
  )
  .refine((d) => d.occasion !== null, "เลือกโอกาสในการเดินทาง")
  .refine((d) => d.vehicle.fuelPrice > 0, "ใส่ราคาน้ำมัน");

export type DraftPlanResult = { plan: TripPlan } | { error: string };

type RouteGroupRow = {
  att_type: number;
  group_key: string;
  province_name_th: string | null;
  route_fraction: number | null;
};

export type RoutePlaceGroupsResult =
  { groups: PlaceGroupOption[]; provinces: string[]; total: number } | { error: string };

/** Counts themes inside a 50 km geographic corridor between the two selected points. */
export async function findRoutePlaceGroups(input: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}): Promise<RoutePlaceGroupsResult> {
  const parsed = z
    .object({
      origin: z.object({ latitude: lat, longitude: lng }),
      destination: z.object({ latitude: lat, longitude: lng }),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "พิกัดต้นทางหรือปลายทางไม่ถูกต้อง" };

  try {
    const route: [number, number][] = [
      [parsed.data.origin.latitude, parsed.data.origin.longitude],
      [parsed.data.destination.latitude, parsed.data.destination.longitude],
    ];
    const { data, error } = await getSupabase().rpc("attractions_along_route", {
      route: toGeoJsonLine(route),
      groups: null,
      buffer_m: 50000,
      max_results: 500,
    });
    if (error) throw error;

    const rows = (data ?? []) as RouteGroupRow[];
    const base = await getPlaceGroups();
    const groupCounts = new Map<string, number>();
    const typeCounts = new Map<number, number>();
    const provinceProgress = new Map<string, number>();
    for (const row of rows) {
      groupCounts.set(row.group_key, (groupCounts.get(row.group_key) ?? 0) + 1);
      typeCounts.set(row.att_type, (typeCounts.get(row.att_type) ?? 0) + 1);
      if (row.province_name_th) {
        provinceProgress.set(
          row.province_name_th,
          Math.min(provinceProgress.get(row.province_name_th) ?? 1, row.route_fraction ?? 1),
        );
      }
    }
    const groups = base
      .map((group) => ({
        ...group,
        total: groupCounts.get(group.key) ?? 0,
        types: group.types
          .map((type) => ({ ...type, total: typeCounts.get(type.id) ?? 0 }))
          .filter((type) => type.total > 0)
          .toSorted((a, b) => b.total - a.total),
      }))
      .filter((group) => group.total > 0);
    const provinces = [...provinceProgress.entries()]
      .toSorted((a, b) => a[1] - b[1])
      .map(([province]) => province);
    return { groups, provinces, total: rows.length };
  } catch (error) {
    console.error("findRoutePlaceGroups failed:", error);
    return { error: "กรองแนวท่องเที่ยวตามพื้นที่ระหว่างทางไม่สำเร็จ กรุณาลองใหม่" };
  }
}

/** Styles to draft side by side: the user's choice first, then ones whose road actually differs. */
function stylesToCompare(chosen: RouteStyle): RouteStyle[] {
  if (chosen === "custom") return ["custom", "fastest"];
  // "mixed" follows the same road as "fastest", so it only appears when chosen.
  const extra = (["fastest", "scenic", "community"] as RouteStyle[]).filter((s) => s !== chosen);
  return [chosen, ...extra].slice(0, 3);
}

export type DraftOptionsResult =
  | {
      options: { style: RouteStyle; plan: TripPlan }[];
      failed: { style: RouteStyle; error: string }[];
    }
  | { error: string };

/** Drafts 2–3 route styles so the user can compare them; one failing doesn't sink the rest. */
export async function draftTripOptions(input: PlannerDraft): Promise<DraftOptionsResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบหรือไม่ถูกต้อง" };
  }
  const styles = stylesToCompare(input.routeStyle);
  // Stagger the starts: the free Valhalla server asks for about one request a second.
  const settled = await Promise.allSettled(
    styles.map(async (style, i) => {
      if (i) await new Promise((r) => setTimeout(r, 400 * i));
      return buildTripPlan({ ...input, routeStyle: style });
    }),
  );
  const options: { style: RouteStyle; plan: TripPlan }[] = [];
  const failed: { style: RouteStyle; error: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      options.push({ style: styles[i], plan: r.value });
    } else {
      if (!(r.reason instanceof PlanError)) console.error(r.reason);
      failed.push({
        style: styles[i],
        error: r.reason instanceof PlanError ? r.reason.message : "ร่างแผนแบบนี้ไม่สำเร็จ",
      });
    }
  });
  if (!options.length)
    return { error: failed[0]?.error ?? "ร่างแผนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  return { options, failed };
}

export async function draftTripPlan(input: PlannerDraft): Promise<DraftPlanResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบหรือไม่ถูกต้อง" };
  }
  try {
    return { plan: await buildTripPlan(input) };
  } catch (error) {
    if (error instanceof PlanError) return { error: error.message };
    console.error(error);
    return { error: "ร่างแผนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}
