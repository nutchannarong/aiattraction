"use server";

import { z } from "zod";
import { simplifyToMax } from "@/lib/geo";
import { poiKindLabel } from "@/lib/places";
import { nearbyCategory, type NearbyPlace } from "@/lib/planner/nearby";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { PlannerDraft } from "@/lib/planner/types";
import { getMockUser } from "@/lib/mock-auth";
import { getSupabase } from "@/lib/supabase";
import { createAuthClient } from "@/lib/supabase-server";

const lat = z.number().min(4).max(22);
const lng = z.number().min(96).max(107);

// Rounded to ~10 m: plenty for "what's nearby", and keeps exact positions out of logs.
const round = (n: number) => Math.round(n * 1e4) / 1e4;

const nearbySchema = z.object({
  lat,
  lng,
  category: z.string().max(20),
  /** The current item's attraction group, for "same kind of place". */
  group: z.string().max(20).nullable().optional(),
  excludeId: z.string().max(40).nullable().optional(),
});

type PoiRow = {
  osm_id: string;
  kind: string;
  subkind: string | null;
  name: string | null;
  brand: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  stars: number | null;
  fee: boolean | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
};

type AttractionRow = {
  att_id: string;
  att_name_th: string;
  group_key: string;
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
};

export type NearbyResult = { items: NearbyPlace[] } | { error: string };

/** Places of one category around a point, nearest first; widens the search when it finds few. */
export async function findNearby(input: z.input<typeof nearbySchema>): Promise<NearbyResult> {
  const parsed = nearbySchema.safeParse(input);
  if (!parsed.success) return { error: "ตำแหน่งไม่ถูกต้อง" };
  const { category, group, excludeId } = parsed.data;
  const at = { lat: round(parsed.data.lat), lng: round(parsed.data.lng) };
  const cat = nearbyCategory(category);
  const db = getSupabase();

  try {
    let items: NearbyPlace[] = [];
    for (const radius of cat.kinds ? [3000, 15000, 40000] : [20000, 60000]) {
      if (cat.kinds) {
        const { data, error } = await db.rpc("nearby_poi", {
          lat: at.lat,
          lng: at.lng,
          kinds: cat.kinds,
          radius_m: radius,
          max_results: 30,
        });
        if (error) throw error;
        items = ((data ?? []) as PoiRow[]).map((r) => ({
          place: {
            source: "poi",
            id: r.osm_id,
            name: r.name ?? r.brand ?? `${poiKindLabel(r.kind)} (ไม่มีชื่อในแผนที่)`,
            area: r.address,
            latitude: r.latitude,
            longitude: r.longitude,
            category: r.kind,
          },
          unnamed: !r.name && !r.brand,
          kindLabel: poiKindLabel(r.kind),
          distanceM: r.distance_m,
          phone: r.phone,
          openingHours: r.opening_hours,
          website: r.website,
          stars: r.stars,
          fee: r.fee,
          subkind: r.subkind,
          feeTh: null,
          feeThKid: null,
        }));
      } else {
        const groups = cat.groups === null ? null : group ? [group] : null;
        const { data, error } = await db.rpc("attractions_near", {
          lat: at.lat,
          lng: at.lng,
          groups,
          radius_m: radius,
          max_results: 30,
        });
        if (error) throw error;
        items = ((data ?? []) as AttractionRow[]).map((r) => ({
          place: {
            source: "attraction",
            id: r.att_id,
            name: r.att_name_th,
            area: [r.district_name_th, r.province_name_th].filter(Boolean).join(" · ") || null,
            latitude: r.latitude,
            longitude: r.longitude,
            category: r.group_key,
            isSecondaryCity: r.is_secondary_city,
          },
          kindLabel: r.att_type_label ?? "แหล่งท่องเที่ยว",
          distanceM: r.distance_m,
          phone: r.att_tel,
          openingHours: r.att_start_end,
          website: null,
          stars: null,
          fee: null,
          subkind: null,
          feeTh: r.att_fee_th,
          feeThKid: r.att_fee_th_kid,
        }));
      }
      items = items.filter((i) => i.place.id !== excludeId);
      if (items.length >= 6) break;
    }
    return { items: items.sort((a, b) => a.distanceM - b.distanceM).slice(0, 20) };
  } catch (error) {
    console.error("findNearby failed:", error);
    return { error: "ค้นหาสถานที่ใกล้เคียงไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export type PlaceDetails = {
  phone: string | null;
  openingHours: string | null;
  website: string | null;
  feeTh: number | null;
  feeThKid: number | null;
  category: string | null;
  kindLabel: string | null;
};

/** Phone, hours and fees for a place picked from search, so the form can fill them in. */
export async function getPlaceDetails(source: string, id: string): Promise<PlaceDetails | null> {
  if (!/^[\w:-]{1,40}$/.test(id)) return null;
  const db = getSupabase();
  if (source === "attraction") {
    const { data } = await db
      .from("attraction")
      .select("att_tel, att_start_end, att_fee_th, att_fee_th_kid, att_type, att_type_label")
      .eq("att_id", id)
      .maybeSingle();
    if (!data) return null;
    const { data: g } = await db
      .from("attraction_type_group")
      .select("group_key")
      .eq("att_type", data.att_type)
      .maybeSingle();
    return {
      phone: data.att_tel,
      openingHours: data.att_start_end,
      website: null,
      feeTh: data.att_fee_th,
      feeThKid: data.att_fee_th_kid,
      category: g?.group_key ?? null,
      kindLabel: data.att_type_label,
    };
  }
  if (source === "poi") {
    const { data } = await db
      .from("poi")
      .select("kind, phone, opening_hours, website")
      .eq("osm_id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      phone: data.phone,
      openingHours: data.opening_hours,
      website: data.website,
      feeTh: null,
      feeThKid: null,
      category: data.kind,
      kindLabel: poiKindLabel(data.kind),
    };
  }
  return null;
}

// ---- Save as "แผนของฉัน"

const text = (max: number) => z.string().max(max).nullable().optional();
const itemSchema = z
  .object({
    kind: z.enum(["drive", "attraction", "poi", "lodging", "meal", "rest_stop", "custom"]),
    start: z
      .string()
      .regex(/^\d\d:\d\d$/)
      .nullable(),
    end: z
      .string()
      .regex(/^\d\d:\d\d$/)
      .nullable(),
    activity: z.string().max(300),
    place: z
      .object({
        source: z.enum(["attraction", "poi", "place", "pin"]),
        name: z.string().max(300),
        latitude: lat,
        longitude: lng,
      })
      .loose()
      .nullable(),
    costEstimate: z.number().min(0).max(10_000_000).nullable(),
    costCategory: z.enum(["fuel", "travel", "admission", "food", "lodging", "other"]).nullable(),
    phone: text(200),
    openingHours: text(500),
    notes: text(2000),
    warning: text(500),
    parking: text(300),
  })
  .loose();

const planSchema = z.object({
  days: z
    .array(
      z.object({
        index: z.int().min(0).max(30),
        date: z.iso.date(),
        finished: z.boolean(),
        items: z.array(itemSchema).max(80),
      }),
    )
    .min(1)
    .max(15),
});

export type SaveTripResult = { id: string } | { needLogin: true } | { error: string };

export async function saveTrip(draft: PlannerDraft, plan: TripPlan): Promise<SaveTripResult> {
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success || !draft.origin || !draft.destination) {
    return { error: "ข้อมูลแผนไม่ครบหรือไม่ถูกต้อง ลองร่างแผนใหม่อีกครั้ง" };
  }

  // The local demo account has no Supabase auth session. The edited plan is
  // already kept in localStorage by useSavedPlan, so mark it saved locally.
  if (await getMockUser()) return { id: `mock-${crypto.randomUUID()}` };

  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { needLogin: true };

  const place = (p: NonNullable<PlannerDraft["origin"]>) => ({
    type: p.type,
    id: p.id ?? null,
    label: p.label,
    sublabel: p.sublabel ?? null,
    lat: p.latitude,
    lng: p.longitude,
    province_id: p.provinceId ?? null,
    is_secondary_city: p.isSecondaryCity ?? null,
  });

  const trip = {
    title: `${draft.origin.label} → ${draft.destination.label}`,
    origin: place(draft.origin),
    destination: place(draft.destination),
    start_date: plan.days[0].date,
    end_date: plan.days[plan.days.length - 1].date,
    travelers: {
      adults: draft.travelers.adults,
      children: draft.travelers.children,
      seniors: draft.travelers.seniors,
      adult_ages: draft.travelers.adultAges,
    },
    occasion: draft.occasion,
    interests: draft.interests,
    stop_kinds: draft.stopKinds,
    vehicle: {
      type: draft.vehicle.type,
      brand: draft.vehicle.brand,
      model: draft.vehicle.model,
      cc: draft.vehicle.cc,
      year: draft.vehicle.year,
      fuel: draft.vehicle.fuel,
      fuel_price: draft.vehicle.fuelPrice,
      km_per_unit: draft.vehicle.efficiencyOverride,
    },
    route_style: draft.routeStyle,
    route_summary: {
      distance_km: Math.round(plan.totals.distanceKm),
      drive_minutes: Math.round(plan.totals.driveMin),
      fuel_units: Math.round(plan.totals.fuelUnits * 10) / 10,
      fuel_cost: Math.round(plan.totals.fuelCost),
      waypoints: plan.waypoints.map((w) => ({ name: w.name, lat: w.latitude, lng: w.longitude })),
      // Thinned lines for the live view later; the full shape can be re-routed.
      outbound: simplifyToMax(plan.outbound.coordinates, 400),
      inbound: plan.inbound ? simplifyToMax(plan.inbound.coordinates, 400) : null,
    },
  };

  const { data, error } = await supabase.rpc("save_trip", {
    p_trip: trip,
    p_days: parsed.data.days,
  });
  if (error) {
    console.error("save_trip failed:", error);
    return { error: "บันทึกแผนไม่สำเร็จ กรุณาลองใหม่" };
  }
  return { id: data as string };
}
