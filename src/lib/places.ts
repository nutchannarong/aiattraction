import { isValidCoordinates } from "./geo";
import type { PlaceRef } from "./planner/types";
import { getSupabase } from "./supabase";

type SearchRow = {
  source: "province" | "area" | "attraction" | "poi";
  id: string;
  name: string;
  kind: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  is_secondary_city: boolean | null;
};

export type PlaceSearchResult = PlaceRef & { kindLabel: string };

const POI_KIND_LABEL: Record<string, string> = {
  restaurant: "ร้านอาหาร",
  cafe: "คาเฟ่",
  hotel: "โรงแรม",
  guest_house: "เกสต์เฮาส์",
  hostel: "โฮสเทล",
  motel: "โมเต็ล",
  apartment: "อพาร์ตเมนต์",
  resort: "รีสอร์ท",
  museum: "พิพิธภัณฑ์",
  atm: "ATM",
  pharmacy: "ร้านขายยา",
  hospital: "โรงพยาบาล",
  clinic: "คลินิก",
  fuel: "ปั๊มน้ำมัน",
  rest_area: "จุดพักรถ",
  services: "จุดบริการริมทาง",
  parking: "ที่จอดรถ",
  toilets: "ห้องน้ำ",
};

export function poiKindLabel(kind: string) {
  return POI_KIND_LABEL[kind] ?? "สถานที่";
}

/** One box for provinces, districts, attractions and OSM places (with context to disambiguate). */
export async function searchPlaces(
  q: string,
  near?: { lat: number; lng: number } | null,
  limit = 12,
): Promise<PlaceSearchResult[]> {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const useNear = near && isValidCoordinates(near.lat, near.lng);
  const { data, error } = await getSupabase().rpc("search_places", {
    q: term,
    near_lat: useNear ? near.lat : null,
    near_lng: useNear ? near.lng : null,
    max_results: limit,
  });
  if (error) throw new Error(`Failed to search places: ${error.message}`);
  return ((data ?? []) as SearchRow[])
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      type: r.source,
      id: r.id,
      label: r.name,
      sublabel: r.area,
      latitude: r.latitude!,
      longitude: r.longitude!,
      isSecondaryCity: r.is_secondary_city,
      provinceId: r.source === "province" ? r.id : null,
      kindLabel: r.source === "poi" ? poiKindLabel(r.kind) : r.kind,
    }));
}

export type NearestArea = {
  district: string;
  province: string;
  province_id: string;
  is_secondary_city: boolean;
  distance_m: number;
};

export async function getNearestArea(lat: number, lng: number): Promise<NearestArea | null> {
  if (!isValidCoordinates(lat, lng)) return null;
  const { data, error } = await getSupabase().rpc("nearest_admin_area", { lat, lng });
  if (error) throw new Error(`Failed to find nearest area: ${error.message}`);
  return ((data ?? []) as NearestArea[])[0] ?? null;
}
