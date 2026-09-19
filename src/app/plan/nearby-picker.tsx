"use client";

import { ExternalLink, Loader2, LocateFixed, MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useGeolocation } from "@/hooks/use-geolocation";
import { formatDistance } from "@/lib/geo";
import { describeParking, nearbyCategory, type NearbyPlace } from "@/lib/planner/nearby";
import { lookupLinks } from "@/lib/planner/poi-categories";
import { closedWarning } from "@/lib/planner/schedule";
import { findNearby, type NearbyResult } from "./editor-actions";

export type NearbyPoint = { latitude: number; longitude: number; label: string };

/**
 * Lists places of a category near a point (a plan item, or the user's GPS position),
 * nearest first, for replacing an item or adding a stop.
 */
export function NearbyPicker({
  categories,
  initialCategory,
  center,
  group,
  excludeId,
  date,
  pickLabel,
  onPick,
  filter,
}: {
  categories: string[];
  initialCategory: string;
  /** Where to search from when GPS isn't used. */
  center: NearbyPoint | null;
  /** Attraction group for the "same kind" category. */
  group?: string | null;
  excludeId?: string | null;
  /** Plan date, to warn about places closed that day. */
  date: string;
  pickLabel: string;
  onPick: (place: NearbyPlace) => void;
  filter?: (place: NearbyPlace) => boolean;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [useGps, setUseGps] = useState(center == null);
  const { state: geo, locate } = useGeolocation();
  const [result, setResult] = useState<{ key: string; res: NearbyResult } | null>(null);

  const point =
    useGps && geo.status === "ready"
      ? { latitude: geo.coords.latitude, longitude: geo.coords.longitude, label: "ตำแหน่งปัจจุบัน" }
      : useGps
        ? null
        : center;
  const key = point
    ? `${category}|${point.latitude.toFixed(4)}|${point.longitude.toFixed(4)}|${group ?? ""}`
    : null;

  const lat = point?.latitude;
  const lng = point?.longitude;

  useEffect(() => {
    if (!key || lat == null || lng == null) return;
    let cancelled = false;
    findNearby({
      lat,
      lng,
      category,
      group: group ?? null,
      excludeId: excludeId ?? null,
    }).then((res) => {
      if (!cancelled) setResult({ key, res });
    });
    return () => {
      cancelled = true;
    };
  }, [key, lat, lng, category, group, excludeId]);

  const current = result && result.key === key ? result.res : null;
  const items = useMemo(
    () => (current && "items" in current ? current.items.filter(filter ?? (() => true)) : []),
    [current, filter],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="ประเภทสถานที่">
        {categories.map((c) => (
          <Chip
            key={c}
            pressed={category === c}
            tone="accent"
            onClick={() => setCategory(c)}
            className="min-h-9 px-3 text-xs"
          >
            {nearbyCategory(c).label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-subtle">ค้นหาใกล้:</span>
        {center && (
          <Chip pressed={!useGps} onClick={() => setUseGps(false)} className="min-h-9 px-3 text-xs">
            <MapPin className="size-3.5" aria-hidden="true" /> {center.label}
          </Chip>
        )}
        <Chip
          pressed={useGps}
          onClick={() => {
            setUseGps(true);
            if (geo.status !== "ready") void locate();
          }}
          className="min-h-9 px-3 text-xs"
        >
          <LocateFixed className="size-3.5" aria-hidden="true" />
          {geo.status === "locating" ? "กำลังหาตำแหน่ง…" : "ตำแหน่งปัจจุบัน (GPS)"}
        </Chip>
      </div>
      {useGps && geo.status === "error" && <p className="text-xs text-danger">{geo.message}</p>}
      {useGps && geo.status === "idle" && (
        <Button variant="mini" onClick={() => void locate()}>
          <LocateFixed className="size-3.5" aria-hidden="true" /> ขอใช้ตำแหน่งปัจจุบัน
        </Button>
      )}

      {point && !current && (
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          กำลังค้นหาสถานที่ใกล้เคียง…
        </p>
      )}
      {current && "error" in current && <p className="text-sm text-danger">{current.error}</p>}
      {current && "items" in current && items.length === 0 && (
        <p className="text-sm text-subtle">
          ไม่พบสถานที่ประเภทนี้ในข้อมูล OpenStreetMap ใกล้จุดนี้ ลองประเภทอื่นหรือค้นหาชื่อเอง
        </p>
      )}

      <ul className="space-y-2">
        {items.map((p) => {
          const warn = closedWarning(p.openingHours, date);
          const [maps] = lookupLinks(p.place.name, p.place.area);
          return (
            <li
              key={`${p.place.source}:${p.place.id}`}
              className="flex flex-wrap items-start gap-3 rounded-xl border-[1.5px] border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {p.place.name}
                  {p.place.isSecondaryCity && <Badge tone="brand">เมืองรอง</Badge>}
                  {p.stars != null && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-accent">
                      <Star className="size-3 fill-current" aria-hidden="true" />
                      {p.stars}
                    </span>
                  )}
                </p>
                <p className="text-xs text-subtle">
                  {[
                    p.place.category === "parking" ? describeParking(p) : p.kindLabel,
                    formatDistance(p.distanceM),
                    p.place.area,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.openingHours && (
                  <p className="text-xs text-subtle">เวลาเปิด: {p.openingHours}</p>
                )}
                {p.phone && <p className="text-xs text-subtle">โทร {p.phone}</p>}
                {warn && <p className="text-xs font-semibold text-danger">{warn}</p>}
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5">
                <Button variant="mini" onClick={() => onPick(p)}>
                  {pickLabel}
                </Button>
                <a
                  href={maps.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-info underline"
                >
                  <ExternalLink className="size-3" aria-hidden="true" /> ดูใน Google Maps
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
