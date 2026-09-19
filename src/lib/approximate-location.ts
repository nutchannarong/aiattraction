import { isValidCoordinates, type Coordinates } from "./geo";

export type ApproximateLocation = Coordinates & { label: string };

function decode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * City-level location from the IP geolocation headers Vercel adds to every request.
 * Not available in local development.
 */
export function getApproximateLocation(headers: Headers): ApproximateLocation | null {
  const latitude = Number(headers.get("x-vercel-ip-latitude"));
  const longitude = Number(headers.get("x-vercel-ip-longitude"));
  if (!headers.get("x-vercel-ip-latitude") || !isValidCoordinates(latitude, longitude)) return null;

  const label =
    [decode(headers.get("x-vercel-ip-city")), headers.get("x-vercel-ip-country")]
      .filter(Boolean)
      .join(", ") || "ไม่ทราบเมือง";
  return { latitude, longitude, label };
}
