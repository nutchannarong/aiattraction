import { cache } from "react";
import { getSupabase } from "./supabase";

export type Province = {
  id: string;
  name_th: string;
  region_th: string | null;
  is_secondary_city: boolean;
  latitude: number | null;
  longitude: number | null;
};

/** All 77 provinces with the main/secondary-city ("เมืองหลัก/เมืองรอง") flag. */
export const getProvinces = cache(async (): Promise<Province[]> => {
  const { data, error } = await getSupabase()
    .from("provinces")
    .select("id, name_th, region_th, is_secondary_city, latitude, longitude")
    .order("name_th")
    .returns<Province[]>();
  if (error) throw new Error(`Failed to load provinces: ${error.message}`);
  return data ?? [];
});

export function cityTierLabel(isSecondary: boolean) {
  return isSecondary ? "เมืองรอง" : "เมืองหลัก";
}
