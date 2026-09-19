"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { isLocationGranted, useGeolocation } from "@/hooks/use-geolocation";
import type { NearbyAttraction } from "@/lib/attractions";
import { formatDistance, NEARBY_RADIUS_M } from "@/lib/geo";
import {
  findNearbyAttractions,
  findNearbyByApproximateLocation,
  type NearbyResult,
} from "./actions";

// ~100 m precision is enough for "near me" and avoids sending the exact position.
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function NearbyList() {
  const { state, locate } = useGeolocation();
  const [items, setItems] = useState<NearbyAttraction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approximateLabel, setApproximateLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Skip the button when permission was already granted on an earlier visit.
  useEffect(() => {
    isLocationGranted().then((granted) => {
      if (granted) void locate();
    });
  }, [locate]);

  const showResult = (result: NearbyResult) => {
    if ("error" in result) {
      setError(result.error);
      setItems(null);
    } else {
      setError(null);
      setItems(result.items);
      setApproximateLabel(result.approximateLabel ?? null);
    }
  };

  const coords = state.status === "ready" ? state.coords : null;
  useEffect(() => {
    if (!coords) return;
    startTransition(async () => {
      showResult(await findNearbyAttractions(round3(coords.latitude), round3(coords.longitude)));
    });
  }, [coords]);

  const useApproximateLocation = () =>
    startTransition(async () => showResult(await findNearbyByApproximateLocation()));

  const busy = state.status === "locating" || isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void locate()}
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-5 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {state.status === "locating"
            ? "กำลังระบุตำแหน่ง…"
            : isPending
              ? "กำลังค้นหา…"
              : state.status === "ready"
                ? "อัปเดตตำแหน่ง"
                : "ใช้ตำแหน่งปัจจุบันของฉัน"}
        </button>
        {state.status === "error" && (
          <button
            onClick={useApproximateLocation}
            disabled={busy}
            className="min-h-11 rounded-lg border border-border px-4 text-sm hover:border-accent disabled:opacity-60"
          >
            ใช้ตำแหน่งโดยประมาณจากเครือข่ายแทน
          </button>
        )}
        {approximateLabel ? (
          <span className="text-sm text-muted">
            ตำแหน่งโดยประมาณจากเครือข่าย: {approximateLabel} (ระดับเมือง)
          </span>
        ) : (
          state.status === "ready" && (
            <span className="text-sm text-muted">
              ตำแหน่งของคุณ {state.coords.latitude.toFixed(4)}, {state.coords.longitude.toFixed(4)}{" "}
              (คลาดเคลื่อน ±{formatDistance(state.accuracy)})
            </span>
          )
        )}
      </div>

      <div aria-live="polite">
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {items && items.length === 0 && (
          <p className="py-8 text-center text-muted">
            ไม่พบสถานที่ท่องเที่ยวในรัศมี {NEARBY_RADIUS_M / 1000} กม.
          </p>
        )}
      </div>

      {items && items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.att_id}>
              <Link
                href={`/attractions/${a.att_id}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-accent">{a.att_type_label}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatDistance(a.distance_m)}
                  </span>
                </span>
                <span className="font-semibold leading-snug">{a.att_name_th}</span>
                {a.att_name_en && <span className="text-sm text-muted">{a.att_name_en}</span>}
                <span className="mt-auto pt-2 text-sm text-muted">
                  {[a.district_name_th, a.province_name_th].filter(Boolean).join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
