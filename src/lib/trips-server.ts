import "server-only";

import { getMockUser } from "./mock-auth";
import { vehicleTypeInfo } from "./planner/vehicles";
import { createAuthClient } from "./supabase-server";
import type { LiveTrip, LiveTripItem, TripSummary } from "./trip-data";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function label(value: unknown, fallback: string) {
  return text(object(value).label, fallback);
}

function vehicleLabel(value: unknown) {
  const type = text(object(value).type);
  try {
    return vehicleTypeInfo(type as Parameters<typeof vehicleTypeInfo>[0]).label;
  } catch {
    return "รถยนต์";
  }
}

function routeMetric(value: unknown, key: string) {
  return number(object(value)[key]);
}

function mapItem(row: JsonObject): LiveTripItem {
  const latitude = typeof row.latitude === "number" ? row.latitude : null;
  const longitude = typeof row.longitude === "number" ? row.longitude : null;
  return {
    id: text(row.id),
    kind: text(row.kind, "custom") as LiveTripItem["kind"],
    start: typeof row.start_time === "string" ? row.start_time.slice(0, 5) : null,
    end: typeof row.end_time === "string" ? row.end_time.slice(0, 5) : null,
    activity: text(row.activity),
    place:
      latitude != null && longitude != null && typeof row.place_name === "string"
        ? {
            source: text(row.place_source, "place") as NonNullable<LiveTripItem["place"]>["source"],
            id: typeof row.place_id === "string" ? row.place_id : undefined,
            name: row.place_name,
            area: typeof row.address === "string" ? row.address : null,
            latitude,
            longitude,
            category: typeof row.place_category === "string" ? row.place_category : null,
            isSecondaryCity:
              typeof row.is_secondary_city === "boolean" ? row.is_secondary_city : null,
          }
        : null,
    costEstimate: typeof row.cost_estimate === "number" ? row.cost_estimate : null,
    costCategory:
      typeof row.cost_category === "string"
        ? (row.cost_category as LiveTripItem["costCategory"])
        : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    openingHours: typeof row.opening_hours === "string" ? row.opening_hours : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    warning: typeof row.warning === "string" ? row.warning : null,
    parking: typeof row.parking === "string" ? row.parking : null,
    progressStatus:
      row.progress_status === "completed" || row.progress_status === "skipped"
        ? row.progress_status
        : "pending",
  };
}

export async function getMyTripSummaries(): Promise<TripSummary[]> {
  if (await getMockUser()) return [];
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return [];

  const { data, error } = await supabase
    .from("trips")
    .select("id,title,origin,destination,start_date,end_date,vehicle,route_summary,status,trip_days(id,trip_items(id,kind,latitude,longitude))")
    .order("start_date", { ascending: true });
  if (error) {
    console.error("getMyTripSummaries failed:", error);
    return [];
  }

  return ((data ?? []) as unknown as JsonObject[]).map((row) => {
    const days = Array.isArray(row.trip_days) ? (row.trip_days as JsonObject[]) : [];
    const stopCount = days.reduce((total, day) => {
      const items = Array.isArray(day.trip_items) ? (day.trip_items as JsonObject[]) : [];
      return total + items.filter((item) => item.kind !== "drive" && item.latitude != null).length;
    }, 0);
    return {
      id: text(row.id),
      source: "supabase",
      title: text(row.title),
      originLabel: label(row.origin, "ต้นทาง"),
      destinationLabel: label(row.destination, "ปลายทาง"),
      startDate: text(row.start_date),
      endDate: text(row.end_date),
      dayCount: days.length,
      stopCount,
      distanceKm: routeMetric(row.route_summary, "distance_km"),
      fuelCost: routeMetric(row.route_summary, "fuel_cost"),
      vehicleLabel: vehicleLabel(row.vehicle),
      status: text(row.status, "upcoming") as TripSummary["status"],
    };
  });
}

export async function getMyTrip(id: string): Promise<LiveTrip | null> {
  if (await getMockUser()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;

  const { data, error } = await supabase
    .from("trips")
    .select("id,title,origin,destination,status,trip_days(id,day_index,date,finished_at,trip_items(id,position,start_time,end_time,activity,kind,place_source,place_id,place_name,place_category,is_secondary_city,latitude,longitude,address,cost_estimate,cost_category,phone,opening_hours,notes,parking,warning,progress_status,completed_at))")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("getMyTrip failed:", error);
    return null;
  }

  const row = data as unknown as JsonObject;
  const days = (Array.isArray(row.trip_days) ? (row.trip_days as JsonObject[]) : [])
    .map((day) => ({
      id: text(day.id),
      index: number(day.day_index),
      date: text(day.date),
      finished: day.finished_at != null,
      items: (Array.isArray(day.trip_items) ? (day.trip_items as JsonObject[]) : [])
        .toSorted((a, b) => number(a.position) - number(b.position))
        .map(mapItem),
    }))
    .toSorted((a, b) => a.index - b.index);

  return {
    id: text(row.id),
    source: "supabase",
    title: text(row.title),
    originLabel: label(row.origin, "ต้นทาง"),
    destinationLabel: label(row.destination, "ปลายทาง"),
    status: text(row.status, "upcoming") as LiveTrip["status"],
    days,
  };
}
