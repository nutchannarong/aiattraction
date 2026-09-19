import { NextResponse } from "next/server";
import { getNearbyRoadside, type RoadsidePoi } from "@/lib/roadside";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPoints = url.searchParams.get("points");
  if (!rawPoints) return NextResponse.json({ items: [] });

  const points = rawPoints.split(";").flatMap((point) => {
    const [lat, lng] = point.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
  });

  const results = await Promise.all(
    points.slice(0, 12).map((point) => getNearbyRoadside(point.lat, point.lng, 5000, 5)),
  );
  const items = new Map<string, RoadsidePoi>();

  for (const result of results) {
    for (const item of [...(result?.fuel ?? []), ...(result?.restStops ?? [])]) {
      items.set(item.osm_id, item);
    }
  }

  return NextResponse.json({
    items: [...items.values()].map((item) => ({
      id: item.osm_id,
      kind: item.kind,
      name: item.name ?? item.brand ?? "จุดแวะพักริมทาง",
      latitude: item.latitude,
      longitude: item.longitude,
      distanceKm: item.distance_m / 1000,
    })),
  });
}
