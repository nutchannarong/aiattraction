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

  const city = decode(headers.get("x-vercel-ip-city"));
  const country = headers.get("x-vercel-ip-country");
  const countryName = country === "TH" ? "ประเทศไทย" : country;
  // Without a city the point is only a country-level centroid, so say so.
  const label = city
    ? [city, countryName].filter(Boolean).join(", ") + " (ระดับเมือง)"
    : `${countryName ?? "ไม่ทราบพื้นที่"} (หยาบมาก อาจคลาดเคลื่อนหลายสิบกิโลเมตร)`;
  return { latitude, longitude, label };
}
