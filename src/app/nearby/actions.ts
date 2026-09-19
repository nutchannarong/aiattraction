"use server";

import { getNearbyAttractions, type NearbyAttraction } from "@/lib/attractions";
import { isValidCoordinates } from "@/lib/geo";

export type NearbyResult = { items: NearbyAttraction[] } | { error: string };

// Coordinates arrive in the POST body (not the URL) so they don't end up in logs.
export async function findNearbyAttractions(
  latitude: number,
  longitude: number,
): Promise<NearbyResult> {
  if (!isValidCoordinates(latitude, longitude)) return { error: "พิกัดไม่ถูกต้อง" };
  try {
    return { items: await getNearbyAttractions(latitude, longitude) };
  } catch (error) {
    console.error(error);
    return { error: "ไม่สามารถค้นหาสถานที่ใกล้เคียงได้ในขณะนี้" };
  }
}
