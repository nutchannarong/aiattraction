"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/planner/types";

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin" style="background:#c8431a"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="4"/></svg></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, map, zoom]);
  return null;
}

/** Small OSM map showing one pin; with onPick, clicking the map moves the pin. */
export default function PinMap({
  center,
  marker,
  zoom = 13,
  onPick,
  className = "h-44",
}: {
  center: LatLng;
  marker: LatLng | null;
  zoom?: number;
  onPick?: (p: LatLng) => void;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border-2 border-foreground ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={Boolean(onPick)}
        className={`h-full w-full ${onPick ? "cursor-crosshair" : ""}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={marker ?? center} zoom={zoom} />
        {marker && <Marker position={[marker.lat, marker.lng]} icon={pinIcon} />}
        {onPick && <ClickToPick onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
