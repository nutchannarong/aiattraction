"use client";

import { useEffect } from "react";
import { isLocationGranted, useGeolocation } from "@/hooks/use-geolocation";
import { distanceMeters, formatDistance, type Coordinates } from "@/lib/geo";

/** Distance from the viewer, computed in the browser; the position never leaves the device. */
export function DistanceFromMe({ target }: { target: Coordinates }) {
  const { state, locate } = useGeolocation();

  useEffect(() => {
    isLocationGranted().then((granted) => granted && locate());
  }, [locate]);

  if (state.status === "ready") {
    return (
      <div>
        <dt className="text-muted">ระยะทางจากคุณ (เส้นตรง)</dt>
        <dd className="font-medium">{formatDistance(distanceMeters(state.coords, target))}</dd>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={locate}
        disabled={state.status === "locating"}
        className="text-accent underline-offset-2 hover:underline disabled:opacity-60"
      >
        {state.status === "locating" ? "กำลังระบุตำแหน่ง…" : "ดูระยะทางจากตำแหน่งของฉัน"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
    </div>
  );
}
