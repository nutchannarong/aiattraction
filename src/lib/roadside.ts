import { getSupabase } from "./supabase";

export { formatDistance } from "./geo";

// Fuel stations and rest stops from OpenStreetMap, stored in public.roadside_poi.

export type RoadsidePoi = {
  osm_id: string;
  kind: "fuel" | "rest_area" | "services";
  name: string | null;
  brand: string | null;
  opening_hours: string | null;
  latitude: number;
  longitude: number;
  distance_m: number;
};

const SEARCH_RADIUS_M = 30000;
const PER_KIND = 5;

export async function getNearbyRoadside(
  latitude: number,
  longitude: number,
  radiusM = SEARCH_RADIUS_M,
  perKind = PER_KIND,
) {
  const { data, error } = await getSupabase().rpc("nearby_roadside_poi", {
    lat: latitude,
    lng: longitude,
    radius_m: radiusM,
    per_kind: perKind,
  });
  if (error) {
    console.error("nearby_roadside_poi failed:", error.message);
    return null;
  }
  const items = (data ?? []) as RoadsidePoi[];
  return {
    fuel: items.filter((p) => p.kind === "fuel"),
    restStops: items.filter((p) => p.kind !== "fuel"),
    radiusKm: radiusM / 1000,
  };
}

export function directionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
