"use client";

import L from "leaflet";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { DayPlan, PlanPlace } from "@/lib/planner/plan-types";

type Point = {
  key: string;
  label: string;
  time: string | null;
  latitude: number;
  longitude: number;
};

type Props = {
  day: DayPlan;
  start: Pick<PlanPlace, "name" | "latitude" | "longitude"> | null;
};

const iconCache = new Map<string, L.DivIcon>();

function numberedIcon(index: number, isStart: boolean) {
  const text = isStart ? "A" : String(index);
  const key = `${text}:${isStart}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: renderToStaticMarkup(
        <span
          className="map-pin"
          style={{
            background: isStart ? "#0f766e" : "#f4622e",
            width: 28,
            height: 28,
            fontSize: 11,
            fontWeight: 800,
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

function FitPoints({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 13);
    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
        { padding: [28, 28] },
      );
    }
  }, [map, points]);
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

export default function DailyPlanMap({ day, start }: Props) {
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

  const routeUrl = googleMapsRoute(points);
  if (points.length === 0) {
    return <p className="p-4 text-sm text-subtle">วันนี้ยังไม่มีสถานที่ในแผนให้แสดงบนแผนที่</p>;
  }

  return (
    <div className="relative h-64 overflow-hidden bg-surface-2 sm:h-72">
      <MapContainer
        center={[points[0].latitude, points[0].longitude]}
        zoom={12}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPoints points={points} />
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: "#f4622e", weight: 4, opacity: 0.85, dashArray: "8 6" }}
          />
        )}
        {points.map((point, index) => (
          <Marker
            key={point.key}
            position={[point.latitude, point.longitude]}
            icon={numberedIcon(start ? index : index + 1, index === 0 && start != null)}
          >
            <Popup>
              <div className="min-w-36 text-sm">
                {point.time && <p className="font-mono text-xs text-secondary">{point.time}</p>}
                <p className="font-semibold">{point.label}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
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
    </div>
  );
}
