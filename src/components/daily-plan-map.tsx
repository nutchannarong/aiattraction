"use client";

import L from "leaflet";
import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { PlanPlace } from "@/lib/planner/plan-types";

type Point = {
  key: string;
  label: string;
  time: string | null;
  latitude: number;
  longitude: number;
};

type Props = {
  day: {
    index: number;
    items: Array<{ id: string; start: string | null; place: PlanPlace | null }>;
  };
  start: Pick<PlanPlace, "name" | "latitude" | "longitude"> | null;
  /** Nearby alternatives shown while replacing a stop. */
  alternatives?: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  onSelectAlternative?: (id: string) => void;
  className?: string;
  /** Live-trip state; omitted when editing a draft itinerary. */
  activeItemId?: string | null;
  completedItemIds?: string[];
  currentPosition?: { latitude: number; longitude: number; accuracy: number } | null;
};

const iconCache = new Map<string, L.DivIcon>();

function numberedIcon(
  index: number,
  isStart: boolean,
  tone: "route" | "alternative" | "completed" | "active" = "route",
) {
  const text = isStart ? "A" : String(index);
  const key = `${text}:${isStart}:${tone}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: renderToStaticMarkup(
        <span
          className="map-pin"
          style={{
            background:
              tone === "alternative"
                ? "#2563eb"
                : tone === "completed"
                  ? "#6b7280"
                  : tone === "active"
                    ? "#f4622e"
                    : isStart
                      ? "#0f766e"
                      : "#f4622e",
            width: 28,
            height: 28,
            fontSize: 11,
            fontWeight: 800,
            boxShadow: tone === "active" ? "0 0 0 5px rgba(244, 98, 46, 0.28)" : undefined,
          }}
        >
          {text}
        </span>,
      ),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -13],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitPoints({ points, fullscreen }: { points: Point[]; fullscreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 13);
      if (points.length > 1) {
        map.fitBounds(
          L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
          { padding: fullscreen ? [60, 60] : [28, 28], maxZoom: 13 },
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fullscreen, map, points]);
  return null;
}

function googleMapsRoute(points: Point[]) {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${points[0].latitude},${points[0].longitude}`;
  }
  const middle = points
    .slice(1, -1)
    .slice(0, 9)
    .map((p) => `${p.latitude},${p.longitude}`)
    .join("|");
  const first = points[0];
  const last = points[points.length - 1];
  return `https://www.google.com/maps/dir/?api=1&origin=${first.latitude},${first.longitude}&destination=${last.latitude},${last.longitude}&travelmode=driving${middle ? `&waypoints=${encodeURIComponent(middle)}` : ""}`;
}

export default function DailyPlanMap({
  day,
  start,
  alternatives,
  onSelectAlternative,
  className = "",
  activeItemId = null,
  completedItemIds = [],
  currentPosition = null,
}: Props) {
  const mapWrapper = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const points = useMemo(() => {
    const raw: Point[] = [];
    if (start) {
      raw.push({
        key: `start-${day.index}`,
        label: start.name,
        time: null,
        latitude: start.latitude,
        longitude: start.longitude,
      });
    }
    for (const item of day.items) {
      if (!item.place) continue;
      raw.push({
        key: item.id,
        label: item.place.name,
        time: item.start,
        latitude: item.place.latitude,
        longitude: item.place.longitude,
      });
    }
    return raw.filter(
      (point, index) =>
        index === 0 ||
        point.latitude !== raw[index - 1].latitude ||
        point.longitude !== raw[index - 1].longitude,
    );
  }, [day, start]);

  const alternativeMode = alternatives != null;
  const completed = useMemo(() => new Set(completedItemIds), [completedItemIds]);
  const alternativePoints = useMemo(
    () =>
      alternatives?.map((alternative) => ({
        key: `alternative-${alternative.id}`,
        label: alternative.name,
        time: null,
        latitude: alternative.latitude,
        longitude: alternative.longitude,
      })) ?? [],
    [alternatives],
  );
  const shownPoints = alternativeMode ? alternativePoints : points;
  const routeUrl = alternativeMode ? null : googleMapsRoute(points);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === mapWrapper.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (!mapWrapper.current) return;
    try {
      if (document.fullscreenElement === mapWrapper.current) await document.exitFullscreen();
      else await mapWrapper.current.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by an embedded browser; the normal preview remains usable.
    }
  };

  if (shownPoints.length === 0) {
    return <p className="p-4 text-sm text-subtle">วันนี้ยังไม่มีสถานที่ในแผนให้แสดงบนแผนที่</p>;
  }

  return (
    <div
      ref={mapWrapper}
      className={`relative min-h-72 overflow-hidden bg-surface-2 ${fullscreen ? "h-dvh w-dvw" : ""} ${className}`}
    >
      <MapContainer
        center={[shownPoints[0].latitude, shownPoints[0].longitude]}
        zoom={12}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={shownPoints} fullscreen={fullscreen} />
        {!alternativeMode && points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: "#f4622e", weight: 4, opacity: 0.85, dashArray: "8 6" }}
          />
        )}
        {shownPoints.map((point, index) => (
          <Marker
            key={point.key}
            position={[point.latitude, point.longitude]}
            icon={numberedIcon(
              alternativeMode ? index + 1 : start ? index : index + 1,
              !alternativeMode && index === 0 && start != null,
              alternativeMode
                ? "alternative"
                : point.key === activeItemId
                  ? "active"
                  : completed.has(point.key)
                    ? "completed"
                    : "route",
            )}
          >
            <Popup>
              <div className="min-w-36 text-sm">
                {point.time && <p className="font-mono text-xs text-secondary">{point.time}</p>}
                <p className="font-semibold">{point.label}</p>
                {alternativeMode && onSelectAlternative && (
                  <button
                    type="button"
                    onClick={() => onSelectAlternative(point.key.replace("alternative-", ""))}
                    className="mt-2 rounded-md bg-accent px-2 py-1 text-xs font-bold text-white"
                  >
                    ใช้ที่นี่แทน
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {currentPosition && !alternativeMode && (
          <CircleMarker
            center={[currentPosition.latitude, currentPosition.longitude]}
            radius={8}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
          >
            <Popup>ตำแหน่งล่าสุดของคุณ (ความแม่นยำประมาณ {Math.round(currentPosition.accuracy)} ม.)</Popup>
          </CircleMarker>
        )}
      </MapContainer>
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="absolute right-3 top-3 z-[500] inline-flex size-9 items-center justify-center rounded-full border-2 border-foreground bg-surface text-foreground shadow-hard-sm hover:bg-surface-2"
        aria-label={fullscreen ? "ออกจากโหมดเต็มจอ" : "ขยายแผนที่เต็มจอ"}
        title={fullscreen ? "ออกจากเต็มจอ" : "ขยายเต็มจอ"}
      >
        {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
      </button>
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 z-[500] inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 border-foreground bg-surface px-3 text-xs font-bold shadow-hard-sm hover:bg-surface-2"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" /> เปิดเส้นทางวันนี้ใน Google Maps
        </a>
      )}
      {activeItemId && !alternativeMode && (
        <div className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] font-semibold shadow-hard-sm">
          <span className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden="true" />
          กำลังอัปเดตเส้นทาง
        </div>
      )}
    </div>
  );
}
