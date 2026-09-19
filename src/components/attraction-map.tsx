"use client";

import dynamic from "next/dynamic";

export { hasValidCoordinates } from "./attraction-map-utils";

export type MapAttraction = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  typeLabel?: string | null;
  province?: string | null;
};

export type RoutePoi = {
  id: string;
  kind: "fuel" | "rest_area" | "services";
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
};

export type RouteStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type DetailMapProps = {
  latitude: number;
  longitude: number;
  name: string;
};

export const AttractionResultsMap = dynamic(
  () => import("./leaflet-map").then((module) => module.AttractionResultsMap),
  { ssr: false },
);

function embedUrl(latitude: number, longitude: number) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    const params = new URLSearchParams({
      key,
      q: `${latitude},${longitude}`,
      zoom: "15",
      language: "th",
    });
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }

  const params = new URLSearchParams({
    q: `${latitude},${longitude}`,
    z: "15",
    hl: "th",
    output: "embed",
  });
  return `https://maps.google.com/maps?${params}`;
}

export function AttractionMap({ latitude, longitude, name }: DetailMapProps) {
  return (
    <iframe
      title={`แผนที่ ${name}`}
      src={embedUrl(latitude, longitude)}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="aspect-[4/3] w-full rounded-lg border border-border"
    />
  );
}
