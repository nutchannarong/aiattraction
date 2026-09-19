"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/lib/geo";

export type GeoState =
  | { status: "idle" | "locating" }
  | { status: "ready"; coords: Coordinates; accuracy: number }
  | { status: "error"; message: string };

const PERMISSION_DENIED = 1;

const ERROR_TH: Record<number, string> = {
  1: "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — กดไอคอนด้านซ้ายของแถบที่อยู่ (แม่กุญแจ/การตั้งค่าเว็บไซต์) แล้วเปลี่ยน “ตำแหน่ง” เป็น “อนุญาต” จากนั้นลองใหม่",
  2: "อุปกรณ์ระบุตำแหน่งไม่ได้ — ตรวจว่าเปิดบริการตำแหน่ง (Location) ของเครื่องแล้ว เช่น Windows: Settings → Privacy & security → Location",
  3: "ใช้เวลาระบุตำแหน่งนานเกินไป — ตรวจว่าเปิดบริการตำแหน่งของเครื่องแล้วลองใหม่",
};

function getPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );
}

/** Browser geolocation, requested only when locate() is called. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const locate = useCallback(async () => {
    if (!window.isSecureContext) {
      setState({ status: "error", message: "ต้องเปิดเว็บผ่าน https จึงจะใช้ตำแหน่งได้" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setState({ status: "error", message: "เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง" });
      return;
    }

    setState({ status: "locating" });
    try {
      let pos: GeolocationPosition;
      try {
        pos = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
      } catch (err) {
        // Desktops without GPS often fail or time out in high-accuracy mode;
        // network-based positioning usually still works.
        if ((err as GeolocationPositionError).code === PERMISSION_DENIED) throw err;
        pos = await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
      }
      setState({
        status: "ready",
        coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        accuracy: Math.round(pos.coords.accuracy),
      });
    } catch (err) {
      const { code, message } = err as GeolocationPositionError;
      setState({ status: "error", message: ERROR_TH[code] ?? message });
    }
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
