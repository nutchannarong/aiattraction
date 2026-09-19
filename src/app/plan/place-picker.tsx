"use client";

import { Crosshair, LocateFixed, MapPin, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { CityTierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/use-geolocation";
import { cn } from "@/lib/cn";
import type { PlaceSearchResult } from "@/lib/places";
import type { LatLng, PlaceRef } from "@/lib/planner/types";

const PinMap = dynamic(() => import("@/components/pin-map"), {
  ssr: false,
  loading: () => (
    <div className="h-44 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
  ),
});

const THAILAND_CENTER: LatLng = { lat: 13.75, lng: 100.5 };

type NearestArea = {
  district: string;
  province: string;
  province_id: string;
  is_secondary_city: boolean;
};

async function describePoint(
  p: LatLng,
): Promise<Pick<PlaceRef, "sublabel" | "provinceId" | "isSecondaryCity">> {
  try {
    const res = await fetch(`/api/places/nearest?lat=${p.lat}&lng=${p.lng}`);
    const { area } = (await res.json()) as { area?: NearestArea };
    if (!area) return { sublabel: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` };
    return {
      sublabel: `ใกล้ อ.${area.district} จ.${area.province}`,
      provinceId: area.province_id,
      isSecondaryCity: area.is_secondary_city,
    };
  } catch {
    return { sublabel: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` };
  }
}

const TYPE_LABEL: Record<PlaceRef["type"], string> = {
  province: "จังหวัด",
  area: "อำเภอ / ตำบล",
  attraction: "แหล่งท่องเที่ยว",
  poi: "สถานที่",
  gps: "ตำแหน่งปัจจุบัน (GPS)",
  pin: "หมุดที่ปักเอง",
};

/** Pick a place by search, GPS or map pin; shows a mini map so the user can confirm it's the right one. */
export function PlacePicker({
  label,
  value,
  onChange,
  near,
  suggestions = [],
  placeholder = "พิมพ์จังหวัด อำเภอ หรือชื่อสถานที่",
}: {
  label: string;
  value: PlaceRef | null;
  onChange: (place: PlaceRef | null) => void;
  near?: LatLng | null;
  suggestions?: { label: string; place: PlaceRef }[];
  placeholder?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: PlaceSearchResult[] }>({
    q: "",
    items: [],
  });
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pinning, setPinning] = useState(false);
  const { state: geo, locate } = useGeolocation();
  const handledFix = useRef<string | null>(null);

  // Only show results for what is currently typed.
  const results = query.trim().length >= 2 && found.q === query.trim() ? found.items : [];

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ q });
        if (near) {
          params.set("lat", String(near.lat));
          params.set("lng", String(near.lng));
        }
        const res = await fetch(`/api/places?${params}`, { signal: controller.signal });
        const body = (await res.json()) as { items: PlaceSearchResult[]; error?: string };
        setFound({ q, items: body.items });
        setActive(0);
        setStatus(body.error ? "error" : "idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, near]);

  // A fresh GPS fix becomes the selected place.
  useEffect(() => {
    if (geo.status !== "ready") return;
    const key = `${geo.coords.latitude},${geo.coords.longitude}`;
    if (handledFix.current === key) return;
    handledFix.current = key;
    const p = { lat: geo.coords.latitude, lng: geo.coords.longitude };
    describePoint(p).then((info) =>
      onChange({
        type: "gps",
        label: "ตำแหน่งปัจจุบัน",
        latitude: p.lat,
        longitude: p.lng,
        ...info,
      }),
    );
  }, [geo, onChange]);

  const choose = (place: PlaceRef) => {
    onChange(place);
    setQuery("");
    setFound({ q: "", items: [] });
    setPinning(false);
  };

  const pickPin = async (p: LatLng) => {
    const info = await describePoint(p);
    onChange({ type: "pin", label: "หมุดที่ปักเอง", latitude: p.lat, longitude: p.lng, ...info });
  };

  if (value && !pinning) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-subtle">{label}</p>
        <div className="rounded-xl border-2 border-foreground bg-surface-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 font-display font-bold">
                <MapPin className="size-4 flex-none text-accent" aria-hidden="true" />
                {value.label}
                {value.isSecondaryCity != null && (
                  <CityTierBadge isSecondary={value.isSecondaryCity} />
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {TYPE_LABEL[value.type]}
                {value.sublabel ? ` · ${value.sublabel}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="grid size-10 flex-none place-items-center rounded-full hover:bg-surface-2"
              aria-label={`เปลี่ยน${label}`}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <PinMap
            center={{ lat: value.latitude, lng: value.longitude }}
            marker={{ lat: value.latitude, lng: value.longitude }}
            zoom={value.type === "province" ? 9 : 13}
            className="mt-2.5 h-36"
          />
          <p className="mt-1.5 text-[11px] text-subtle">
            ตรวจดูบนแผนที่ว่าเป็นที่เดียวกับที่ตั้งใจ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`${listId}-input`} className="text-xs font-bold text-subtle">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          aria-hidden="true"
        />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setFound({ q: "", items: [] });
            }
          }}
          className="min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface pl-9 pr-3 focus:border-accent focus:outline-none"
        />
        {results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border-2 border-foreground bg-surface shadow-hard"
          >
            {results.map((r, i) => (
              <li
                key={`${r.type}:${r.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => (e.preventDefault(), choose(r))}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "cursor-pointer border-b border-border-soft px-3.5 py-2.5 last:border-b-0",
                  i === active && "bg-accent-soft",
                )}
              >
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {r.label}
                  {r.isSecondaryCity != null && <CityTierBadge isSecondary={r.isSecondaryCity} />}
                </p>
                <p className="text-xs text-subtle">
                  {r.kindLabel}
                  {r.sublabel ? ` · ${r.sublabel}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {status === "loading" && <p className="text-xs text-subtle">กำลังค้นหา…</p>}
      {status === "error" && <p className="text-xs text-danger">ค้นหาไม่สำเร็จ กรุณาลองใหม่</p>}
      {query.trim().length >= 2 &&
        found.q === query.trim() &&
        status === "idle" &&
        results.length === 0 && (
          <p className="text-xs text-subtle">
            ไม่พบสถานที่ ลองพิมพ์ชื่อจังหวัดหรืออำเภอ หรือปักหมุดบนแผนที่
          </p>
        )}

      <div className="flex flex-wrap gap-2">
        <Button variant="mini" onClick={() => void locate()} disabled={geo.status === "locating"}>
          <LocateFixed className="size-3.5" aria-hidden="true" />
          {geo.status === "locating" ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน (GPS)"}
        </Button>
        <Button variant="mini" onClick={() => setPinning((v) => !v)} aria-pressed={pinning}>
          <Crosshair className="size-3.5" aria-hidden="true" />
          ปักหมุดบนแผนที่
        </Button>
        {suggestions.map((s) => (
          <Button key={s.label} variant="mini" onClick={() => choose(s.place)}>
            {s.label}
          </Button>
        ))}
      </div>
      {geo.status === "error" && <p className="text-xs text-danger">{geo.message}</p>}

      {pinning && (
        <div className="space-y-1.5">
          <PinMap
            center={
              value ? { lat: value.latitude, lng: value.longitude } : (near ?? THAILAND_CENTER)
            }
            marker={value ? { lat: value.latitude, lng: value.longitude } : null}
            zoom={value ? 13 : 6}
            onPick={(p) => void pickPin(p)}
            className="h-64"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-subtle">แตะบนแผนที่เพื่อปักหมุด</p>
            {value && (
              <Button variant="mini" onClick={() => setPinning(false)}>
                ใช้หมุดนี้
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
