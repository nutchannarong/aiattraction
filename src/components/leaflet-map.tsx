"use client";

import L from "leaflet";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapAttraction, RoutePoi, RouteStop } from "./attraction-map";

type Props = {
  latitude: number;
  longitude: number;
  name: string;
};

type ResultsProps = {
  items: MapAttraction[];
  routePois?: RoutePoi[];
  className?: string;
  showRoutePreview?: boolean;
  fitToItems?: boolean;
};

type RoutePreview = {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
};

const MOCK_ORIGIN: [number, number] = [13.7563, 100.5018];

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const poiIcons: Record<RoutePoi["kind"], L.DivIcon> = {
  fuel: L.divIcon({ className: "route-poi-marker route-poi-fuel", html: "⛽" }),
  rest_area: L.divIcon({ className: "route-poi-marker route-poi-rest", html: "🅿️" }),
  services: L.divIcon({ className: "route-poi-marker route-poi-services", html: "🛠️" }),
};

function FitBounds({
  items,
  points,
  fitToItems,
}: {
  items: MapAttraction[];
  points?: [number, number][];
  fitToItems: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length && !fitToItems) return;
    const boundsPoints = points?.length
      ? points
      : items.map((item) => [item.latitude, item.longitude] as [number, number]);
    if (boundsPoints.length === 0) return;
    const bounds = L.latLngBounds(boundsPoints);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: points ? 10 : items.length === 1 ? 13 : 10 });
  }, [fitToItems, items, map, points]);

  return null;
}

function MapAttractions({
  items,
  stops,
  onToggleStop,
}: {
  items: MapAttraction[];
  stops: RouteStop[];
  onToggleStop: (stop: RouteStop) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Marker key={item.id} position={[item.latitude, item.longitude]} icon={markerIcon}>
          <Popup>
            <div className="space-y-1 text-sm">
              {item.typeLabel && <p className="text-xs text-gray-500">{item.typeLabel}</p>}
              <p className="font-semibold">{item.name}</p>
              {item.province && <p>{item.province}</p>}
              <Link className="text-teal-700 underline" href={`/attractions/${item.id}`}>
                ดูรายละเอียด
              </Link>
              <a
                className="block text-teal-700 underline"
                href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                นำทางด้วย Google Maps
              </a>
              <button
                type="button"
                className="block text-left text-teal-700 underline"
                onClick={() =>
                  onToggleStop({
                    id: item.id,
                    name: item.name,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  })
                }
              >
                {stops.some((stop) => stop.id === item.id)
                  ? "เอาออกจากเส้นทาง"
                  : "เพิ่มเป็นจุดแวะ"}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const POI_LABEL: Record<RoutePoi["kind"], string> = {
  fuel: "ปั๊มน้ำมัน",
  rest_area: "จุดพักรถ",
  services: "จุดบริการริมทาง",
};

function RoutePois({
  items,
  stops,
  onToggleStop,
}: {
  items: RoutePoi[];
  stops: RouteStop[];
  onToggleStop: (stop: RouteStop) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Marker key={item.id} position={[item.latitude, item.longitude]} icon={poiIcons[item.kind]}>
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-gray-500">{POI_LABEL[item.kind]}</p>
              <p className="font-semibold">{item.name}</p>
              {item.distanceKm != null && <p>{item.distanceKm.toFixed(1)} กม. จากเส้นทาง</p>}
              <a
                className="text-teal-700 underline"
                href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                นำทางด้วย Google Maps
              </a>
              <button
                type="button"
                className="block text-left text-teal-700 underline"
                onClick={() =>
                  onToggleStop({
                    id: item.id,
                    name: item.name,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  })
                }
              >
                {stops.some((stop) => stop.id === item.id)
                  ? "เอาออกจากเส้นทาง"
                  : "เพิ่มเป็นจุดแวะ"}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export function AttractionResultsMap({
  items,
  routePois = [],
  className = "",
  showRoutePreview = false,
  fitToItems = false,
}: ResultsProps) {
  const [route, setRoute] = useState<RoutePreview | null>(null);
  const [nearbyPois, setNearbyPois] = useState<RoutePoi[]>(routePois);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const destination = items[0];
  const googleRouteUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&origin=${MOCK_ORIGIN.join(",")}&destination=${destination.latitude},${destination.longitude}&travelmode=driving${
        routeStops.length > 0
          ? `&waypoints=${routeStops.map((stop) => `${stop.latitude},${stop.longitude}`).join("|")}`
          : ""
      }`
    : null;

  const toggleRouteStop = (stop: RouteStop) => {
    setRouteStops((current) =>
      current.some((item) => item.id === stop.id)
        ? current.filter((item) => item.id !== stop.id)
        : [...current, stop],
    );
  };

  useEffect(() => {
    if (!showRoutePreview || !destination) {
      return;
    }

    const controller = new AbortController();

    const waypoints = [
      MOCK_ORIGIN,
      ...routeStops.map((stop) => [stop.latitude, stop.longitude] as [number, number]),
      [destination.latitude, destination.longitude] as [number, number],
    ];
    const coordinatePath = waypoints.map(([latitude, longitude]) => `${longitude},${latitude}`).join(";");

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinatePath}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const result = data?.routes?.[0];
        if (!result) return;
        const nextRoute = {
          coordinates: result.geometry.coordinates.map(([longitude, latitude]: [number, number]) => [
            latitude,
            longitude,
          ]),
          distanceKm: result.distance / 1000,
          durationMinutes: result.duration / 60,
        } satisfies RoutePreview;
        setRoute(nextRoute);

        const step = Math.max(1, Math.floor(nextRoute.coordinates.length / 12));
        const samplePoints = nextRoute.coordinates.filter(
          (_point: [number, number], index: number) => index % step === 0,
        );
        fetch(
          `/api/roadside?points=${encodeURIComponent(samplePoints.map((point: [number, number]) => point.join(",")).join(";"))}`,
        )
          .then((response) => (response.ok ? response.json() : null))
          .then((roadside) => {
            if (Array.isArray(roadside?.items)) setNearbyPois(roadside.items);
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [destination, routeStops, showRoutePreview]);

  return (
    <div className="space-y-3">
      <div className={showRoutePreview ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}>
        <div className={`h-[28rem] overflow-hidden rounded-xl border border-border ${className}`}>
          <MapContainer
            center={[15.87, 100.9925]}
            zoom={6}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds
              items={items}
              fitToItems={fitToItems}
              points={
                showRoutePreview && destination
                  ? route?.coordinates ?? [MOCK_ORIGIN, [destination.latitude, destination.longitude]]
                  : undefined
              }
            />
            <MapAttractions items={items} stops={routeStops} onToggleStop={toggleRouteStop} />
            <RoutePois items={nearbyPois} stops={routeStops} onToggleStop={toggleRouteStop} />
            {showRoutePreview && destination && (
              <>
                <CircleMarker center={MOCK_ORIGIN} radius={8} pathOptions={{ color: "#2563eb" }}>
                  <Popup>จุดเริ่มต้นจำลอง: กรุงเทพฯ</Popup>
                </CircleMarker>
                {route && (
                  <Polyline positions={route.coordinates} pathOptions={{ color: "#2563eb", weight: 5 }} />
                )}
              </>
            )}
          </MapContainer>
        </div>

        {showRoutePreview && (
          <aside className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-semibold">ตัวอย่างเส้นทางการเดินทาง</p>
            <ol className="mt-4 space-y-2">
              <li className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted">จุดเริ่มต้น</p>
                <p className="mt-1 font-medium">กรุงเทพฯ</p>
              </li>
              {routeStops.map((stop, index) => (
                <li key={stop.id} className="rounded-lg border border-accent/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted">จุดแวะ {index + 1}</p>
                      <p className="mt-1 font-medium">{stop.name}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted underline"
                      onClick={() => onToggleStop(stop)}
                    >
                      เอาออก
                    </button>
                  </div>
                </li>
              ))}
              {destination && (
                <li className="rounded-lg border border-accent bg-accent/10 p-3">
                  <p className="text-xs text-muted">จุดหมายปลายทาง</p>
                  <p className="mt-1 font-medium">{destination.name}</p>
                </li>
              )}
            </ol>
            {routeStops.length === 0 && (
              <p className="mt-3 text-xs text-muted">กดหมุดบนแผนที่เพื่อเพิ่มจุดแวะ</p>
            )}
            {route ? (
              <p className="mt-4 text-accent">
                ประมาณ {route.distanceKm.toFixed(1)} กม. · {Math.round(route.durationMinutes)} นาที
              </p>
            ) : (
              <p className="mt-4 text-muted">กำลังคำนวณเส้นทาง…</p>
            )}
            {googleRouteUrl && (
              <a
                href={googleRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-lg bg-accent px-4 py-2 text-center font-medium text-white dark:text-black"
              >
                เปิดเส้นทางนี้ใน Google Maps
              </a>
            )}
          </aside>
        )}
      </div>
      {showRoutePreview && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          <span><span aria-hidden="true">⛽</span> ปั๊มน้ำมัน</span>
          <span><span aria-hidden="true">🅿️</span> จุดพักรถ</span>
          <span><span aria-hidden="true">🛠️</span> จุดบริการริมทาง</span>
        </div>
      )}
    </div>
  );
}

export function AttractionMap({ latitude, longitude, name }: Props) {
  return (
    <AttractionResultsMap
      items={[{ id: "detail", name, latitude, longitude }]}
      fitToItems
      className="aspect-[4/3] h-auto min-h-64"
    />
  );
}
