// Client-safe geo helpers (no server imports).

/** Search radius for "near me". */
export const NEARBY_RADIUS_M = 200000;

export type Coordinates = { latitude: number; longitude: number };

/** Great-circle distance in meters. */
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} ม.` : `${(meters / 1000).toFixed(1)} กม.`;
}

export function isValidCoordinates(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Douglas–Peucker simplification of [lat, lng] points; tolerance in degrees (~0.01 ≈ 1 km). */
export function simplifyLine(points: [number, number][], tolerance = 0.01): [number, number][] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ay, ax] = points[first];
    const [by, bx] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [py, px] = points[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies until at most maxPoints remain (for sending a route to the database). */
export function simplifyToMax(points: [number, number][], maxPoints = 400) {
  let tolerance = 0.002;
  let out = simplifyLine(points, tolerance);
  while (out.length > maxPoints) {
    tolerance *= 2;
    out = simplifyLine(points, tolerance);
  }
  return out;
}

/** GeoJSON LineString ([lng, lat] order) from [lat, lng] points. */
export function toGeoJsonLine(points: [number, number][]) {
  return { type: "LineString" as const, coordinates: points.map(([lat, lng]) => [lng, lat]) };
}

/** Point at a fraction (0–1) of the line's length. */
export function pointAtFraction(points: [number, number][], fraction: number): Coordinates {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = distanceMeters(
      { latitude: points[i - 1][0], longitude: points[i - 1][1] },
      { latitude: points[i][0], longitude: points[i][1] },
    );
    segs.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const t = segs[i] ? target / segs[i] : 0;
      return {
        latitude: points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        longitude: points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      };
    }
    target -= segs[i];
  }
  const [lat, lng] = points[points.length - 1];
  return { latitude: lat, longitude: lng };
}

/** "2 ชม. 35 นาที" / "1 วัน 3 ชม." */
export function formatDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;
  const parts = [];
  if (days) parts.push(`${days} วัน`);
  if (hours) parts.push(`${hours} ชม.`);
  if (mins || parts.length === 0) parts.push(`${mins} นาที`);
  return parts.join(" ");
}
