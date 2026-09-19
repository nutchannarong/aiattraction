"use client";

import dynamic from "next/dynamic";
import type { MapAttraction, RoutePoi } from "@/components/attraction-map";

const RouteMapCanvas = dynamic(
  () => import("./leaflet-map").then((module) => module.AttractionResultsMap),
  { ssr: false },
);

type Props = {
  attractions: MapAttraction[];
  roadsidePois?: RoutePoi[];
  className?: string;
};

/** Shared route map for journeys using the roadside POI data we have today. */
export function RoutePlannerMap({ attractions, roadsidePois = [], className }: Props) {
  return (
    <RouteMapCanvas
      items={attractions}
      routePois={roadsidePois}
      showRoutePreview
      className={className}
    />
  );
}
