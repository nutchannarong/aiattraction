"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  lookupLinks,
  directionsLink,
  poiCategoryOf,
  POI_CATEGORIES,
} from "@/lib/planner/poi-categories";
import type { PlanPlace, RoutePoi } from "@/lib/planner/plan-types";
import type { LatLng } from "@/lib/planner/types";

export type MapStop = { place: PlanPlace; label: string; day: number };

type Props = {
  outbound: [number, number][];
  inbound: [number, number][] | null;
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  stops: MapStop[];
  pois: RoutePoi[];
  visibleCategories: string[];
  groupColors: Record<string, string>;
  /** Custom-route editing: click the map to add a point, drag to move. */
  editing?: {
    points: LatLng[];
    onAdd: (p: LatLng) => void;
    onMove: (index: number, p: LatLng) => void;
    onRemove: (index: number) => void;
  } | null;
  onAddPoi?: (poi: RoutePoi) => void;
  /** Other drafted route options, drawn faintly for comparison. */
  altRoutes?: [number, number][][];
};

const iconCache = new Map<string, L.DivIcon>();

function poiIcon(kind: string) {
  const cat = poiCategoryOf(kind);
  const key = `poi:${cat.key}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const svg = renderToStaticMarkup(<cat.icon size={15} strokeWidth={2.4} aria-hidden="true" />);
    icon = L.divIcon({
      className: "",
      html: `<div class="map-pin" style="background:${cat.color};width:26px;height:26px">${svg}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -12],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function labelIcon(text: string, color: string, size = 30) {
  const key = `label:${text}:${color}:${size}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<div class="map-pin" style="background:${color};width:${size}px;height:${size}px;font:700 12px var(--font-plex-mono),monospace">${text}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitToRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
  }, [map, points]);
  return null;
}

function ClickToAdd({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onAdd({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function PopupLinks({
  name,
  area,
  lat,
  lng,
}: {
  name: string;
  area?: string | null;
  lat: number;
  lng: number;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs">
      <a
        href={directionsLink(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent underline"
      >
        นำทาง
      </a>
      {lookupLinks(name, area).map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info underline"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

/** Trip map: route (dashed for the way home), numbered plan stops, POI layers and custom-route editing. */
export default function TripMap({
  outbound,
  inbound,
  origin,
  destination,
  stops,
  pois,
  visibleCategories,
  groupColors,
  editing,
  onAddPoi,
  altRoutes = [],
}: Props) {
  const fitPoints = useMemo(() => [...outbound, ...(inbound ?? [])], [outbound, inbound]);
  const visiblePois = useMemo(
    () => pois.filter((p) => visibleCategories.includes(poiCategoryOf(p.kind).key)),
    [pois, visibleCategories],
  );

  return (
    <MapContainer center={[15.87, 100.99]} zoom={6} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToRoute points={fitPoints} />
      {altRoutes.map((line, i) => (
        <Polyline
          key={`alt-${i}`}
          positions={line}
          pathOptions={{ color: "#6b7078", weight: 4, opacity: 0.55, dashArray: "2 8" }}
        />
      ))}
      {inbound && (
        <Polyline
          positions={inbound}
          pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.7, dashArray: "8 8" }}
        />
      )}
      <Polyline positions={outbound} pathOptions={{ color: "#14161a", weight: 7, opacity: 0.35 }} />
      <Polyline positions={outbound} pathOptions={{ color: "#f4622e", weight: 4 }} />

      {visiblePois.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={poiIcon(p.kind)}>
          <Popup>
            <div className="min-w-44 text-sm">
              <p className="text-xs text-subtle">{poiCategoryOf(p.kind).label}</p>
              <p className="font-semibold">{p.name ?? p.brand ?? "ไม่มีชื่อในแผนที่"}</p>
              {p.address && <p className="text-xs">{p.address}</p>}
              {p.openingHours && <p className="text-xs">เวลาเปิด: {p.openingHours}</p>}
              {p.phone && <p className="text-xs">โทร {p.phone}</p>}
              <PopupLinks
                name={p.name ?? p.brand ?? ""}
                area={p.address}
                lat={p.latitude}
                lng={p.longitude}
              />
              {onAddPoi && (
                <button
                  type="button"
                  onClick={() => onAddPoi(p)}
                  className="mt-2 text-xs font-bold text-accent underline"
                >
                  + เพิ่มลงแผนรายวัน
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {stops.map((s, i) => (
        <Marker
          key={`${s.place.id ?? i}-${s.day}`}
          position={[s.place.latitude, s.place.longitude]}
          icon={labelIcon(s.label, groupColors[s.place.category ?? ""] ?? "#c8431a")}
          zIndexOffset={500}
        >
          <Popup>
            <div className="min-w-44 text-sm">
              <p className="text-xs text-subtle">วันที่ {s.day + 1}</p>
              <p className="font-semibold">{s.place.name}</p>
              {s.place.area && <p className="text-xs">{s.place.area}</p>}
              <PopupLinks
                name={s.place.name}
                area={s.place.area}
                lat={s.place.latitude}
                lng={s.place.longitude}
              />
            </div>
          </Popup>
        </Marker>
      ))}

      <Marker
        position={[origin.lat, origin.lng]}
        icon={labelIcon("A", "#0f766e", 34)}
        zIndexOffset={1000}
      >
        <Popup>ต้นทาง: {origin.label}</Popup>
      </Marker>
      <Marker
        position={[destination.lat, destination.lng]}
        icon={labelIcon("B", "#c8431a", 34)}
        zIndexOffset={1000}
      >
        <Popup>ปลายทาง: {destination.label}</Popup>
      </Marker>

      {editing && (
        <>
          <ClickToAdd onAdd={editing.onAdd} />
          {editing.points.map((p, i) => (
            <Marker
              key={`wp-${i}`}
              position={[p.lat, p.lng]}
              icon={labelIcon(String(i + 1), "#f4622e", 26)}
              draggable
              zIndexOffset={900}
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  editing.onMove(i, { lat: ll.lat, lng: ll.lng });
                },
                click: () => editing.onRemove(i),
              }}
            />
          ))}
        </>
      )}
    </MapContainer>
  );
}

export { POI_CATEGORIES };
