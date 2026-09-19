"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/lib/geo";

export type GeoState =
  | { status: "idle" | "locating" }
  | { status: "ready"; coords: Coordinates; accuracy: number }
  | { status: "error"; message: string };

const ERROR_TH: Record<number, string> = {
  1: "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่งในการตั้งค่าเบราว์เซอร์",
  2: "ไม่สามารถระบุตำแหน่งได้ในขณะนี้",
  3: "ใช้เวลาระบุตำแหน่งนานเกินไป กรุณาลองใหม่",
};

/** Browser geolocation, requested only when locate() is called. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", message: "เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: "ready",
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) => setState({ status: "error", message: ERROR_TH[err.code] ?? err.message }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  return { state, locate };
}

/** True when the user already granted location access, so asking won't prompt. */
export async function isLocationGranted() {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state === "granted";
  } catch {
    return false;
  }
}
