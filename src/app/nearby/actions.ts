"use server";

import { headers } from "next/headers";
import { getApproximateLocation } from "@/lib/approximate-location";
import { getNearbyAttractions, type NearbyAttraction } from "@/lib/attractions";
import { isValidCoordinates } from "@/lib/geo";

export type NearbyResult =
  { items: NearbyAttraction[]; approximateLabel?: string } | { error: string };

async function search(latitude: number, longitude: number) {
  try {
    return await getNearbyAttractions(latitude, longitude);
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Coordinates arrive in the POST body (not the URL) so they don't end up in logs.
export async function findNearbyAttractions(
  latitude: number,
  longitude: number,
): Promise<NearbyResult> {
  if (!isValidCoordinates(latitude, longitude)) return { error: "พิกัดไม่ถูกต้อง" };
  const items = await search(latitude, longitude);
  return items ? { items } : { error: "ไม่สามารถค้นหาสถานที่ใกล้เคียงได้ในขณะนี้" };
}

/** Fallback when the device can't provide a position: city-level location from the IP. */
export async function findNearbyByApproximateLocation(): Promise<NearbyResult> {
  const location = getApproximateLocation(await headers());
  if (!location) return { error: "ไม่สามารถระบุตำแหน่งโดยประมาณจากเครือข่ายได้" };
  const items = await search(location.latitude, location.longitude);
  return items
    ? { items, approximateLabel: location.label }
    : { error: "ไม่สามารถค้นหาสถานที่ใกล้เคียงได้ในขณะนี้" };
}
