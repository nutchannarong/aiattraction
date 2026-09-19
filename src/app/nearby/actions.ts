"use server";

import { isValidCoordinates } from "@/lib/geo";
import { getSupabase } from "@/lib/supabase";

export type NearbyAttraction = {
  att_id: string;
  att_name_th: string;
  att_name_en: string | null;
  att_type_label: string | null;
  province_name_th: string | null;
  district_name_th: string | null;
  distance_m: number;
};

// Coordinates arrive in the POST body (not the URL) so they don't end up in logs.
export async function findNearbyAttractions(latitude: number, longitude: number) {
  if (!isValidCoordinates(latitude, longitude)) return { error: "พิกัดไม่ถูกต้อง" } as const;

  const { data, error } = await getSupabase().rpc("nearby_attractions", {
    lat: latitude,
    lng: longitude,
    max_results: 30,
    radius_m: 200000,
  });
  if (error) {
    console.error("nearby_attractions failed:", error.message);
    return { error: "ไม่สามารถค้นหาสถานที่ใกล้เคียงได้ในขณะนี้" } as const;
  }
  return { items: (data ?? []) as NearbyAttraction[] } as const;
}
