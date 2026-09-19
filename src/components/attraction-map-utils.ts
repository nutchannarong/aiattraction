// Rough bounding box of Thailand; a few imported rows have coordinates outside it.
export function hasValidCoordinates(lat: number | null, lng: number | null) {
  return lat != null && lng != null && lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106;
}
