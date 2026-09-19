"use client";

import {
  AttractionResultsMap,
  type MapAttraction,
  type RoutePoi,
} from "@/components/attraction-map";

type Props = {
  attractions: MapAttraction[];
  roadsidePois?: RoutePoi[];
  className?: string;
};

/** Shared route map for journeys using the roadside POI data we have today. */
export function RoutePlannerMap({ attractions, roadsidePois = [], className }: Props) {
  return (
    <AttractionResultsMap
      items={attractions}
      routePois={roadsidePois}
      showRoutePreview
      className={className}
    />
  );
}
