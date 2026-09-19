type Props = {
  latitude: number;
  longitude: number;
  name: string;
};

// Rough bounding box of Thailand; a few imported rows have coordinates outside it.
export function hasValidCoordinates(lat: number | null, lng: number | null) {
  return lat != null && lng != null && lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106;
}

function embedUrl(lat: number, lng: number) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  // Official Maps Embed API when a key is configured; keyless embed otherwise.
  if (key) {
    const params = new URLSearchParams({ key, q: `${lat},${lng}`, zoom: "15", language: "th" });
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }
  const params = new URLSearchParams({ q: `${lat},${lng}`, z: "15", hl: "th", output: "embed" });
  return `https://maps.google.com/maps?${params}`;
}

export function AttractionMap({ latitude, longitude, name }: Props) {
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
