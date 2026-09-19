// Road routing via the FOSSGIS Valhalla server (OSM data, free, fair use ≈ 1 request/s),
// falling back to the OSRM demo server for plain car routes. Results are cached by URL.

import type { LatLng } from "./planner/types";

const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const USER_AGENT = "thainhaidee/0.1 (+https://github.com/nutchannarong/aiattraction)";
const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;
export const MAX_ROUTE_POINTS = 20;

export type RouteProfile = {
  /** Valhalla costing model. */
  costing: "auto" | "motorcycle" | "bus";
  /** Prefer smaller roads and skip tolls (scenic/community styles). */
  avoidHighways: boolean;
};

export type RouteLeg = { distanceKm: number; durationMin: number };

export type RoadRoute = {
  /** [lat, lng] pairs along the road. */
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  legs: RouteLeg[];
  engine: "valhalla" | "osrm";
};

/** Decodes an encoded polyline (Valhalla uses precision 6). */
function decodePolyline(str: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = str.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

type ValhallaResponse = {
  trip?: {
    legs: { shape: string; summary: { length: number; time: number } }[];
    summary: { length: number; time: number };
  };
  error?: string;
};

async function valhallaRoute(points: LatLng[], profile: RouteProfile): Promise<RoadRoute | null> {
  const costingOptions = profile.avoidHighways
    ? { [profile.costing]: { use_highways: 0.3, use_tolls: 0 } }
    : undefined;
  const body = {
    locations: points.map((p) => ({
      lat: Number(p.lat.toFixed(5)),
      lon: Number(p.lng.toFixed(5)),
    })),
    costing: profile.costing,
    ...(costingOptions ? { costing_options: costingOptions } : {}),
    units: "kilometers",
    directions_type: "none",
  };
  const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ValhallaResponse;
  if (!data.trip) return null;
  const coordinates = data.trip.legs.flatMap((leg, i) => {
    const pts = decodePolyline(leg.shape);
    return i === 0 ? pts : pts.slice(1);
  });
  return {
    coordinates,
    distanceKm: data.trip.summary.length,
    durationMin: data.trip.summary.time / 60,
    legs: data.trip.legs.map((l) => ({
      distanceKm: l.summary.length,
      durationMin: l.summary.time / 60,
    })),
    engine: "valhalla",
  };
}

type OsrmResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { distance: number; duration: number }[];
  }[];
};

async function osrmRoute(points: LatLng[]): Promise<RoadRoute | null> {
  const path = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const res = await fetch(`${OSRM}/${path}?overview=full&geometries=geojson`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmResponse;
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) return null;
  return {
    coordinates: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    legs: r.legs.map((l) => ({ distanceKm: l.distance / 1000, durationMin: l.duration / 60 })),
    engine: "osrm",
  };
}

/**
 * Road route through the given points (origin, waypoints…, destination).
 * Returns null when no routing server could answer.
 */
export async function roadRoute(
  points: LatLng[],
  profile: RouteProfile,
): Promise<RoadRoute | null> {
  const pts = points.slice(0, MAX_ROUTE_POINTS);
  if (pts.length < 2) return null;
  try {
    const v = await valhallaRoute(pts, profile);
    if (v) return v;
  } catch (error) {
    console.error("Valhalla route failed:", error);
  }
  // OSRM's demo can't avoid highways or route motorcycles; only use it for plain car routes.
  if (profile.costing === "motorcycle" || profile.avoidHighways) return null;
  try {
    return await osrmRoute(pts);
  } catch (error) {
    console.error("OSRM route failed:", error);
    return null;
  }
}
