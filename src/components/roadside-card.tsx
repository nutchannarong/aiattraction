import { directionsUrl, formatDistance, getNearbyRoadside, type RoadsidePoi } from "@/lib/roadside";

type Props = { latitude: number; longitude: number };

const KIND_LABEL: Record<RoadsidePoi["kind"], string> = {
  fuel: "ปั๊มน้ำมัน",
  rest_area: "จุดพักรถ",
  services: "จุดบริการริมทาง",
};

function PoiList({ items, empty }: { items: RoadsidePoi[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((p) => {
        const title = p.name ?? p.brand ?? KIND_LABEL[p.kind];
        const detail = [
          p.name && p.brand && p.brand !== p.name ? p.brand : null,
          p.kind !== "fuel" && title !== KIND_LABEL[p.kind] ? KIND_LABEL[p.kind] : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={p.osm_id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="text-xs text-muted">
                {[
                  formatDistance(p.distance_m),
                  detail,
                  p.opening_hours === "24/7" ? "เปิด 24 ชม." : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <a
              href={directionsUrl(p.latitude, p.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`นำทางไป ${title}`}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-accent hover:border-accent"
            >
              นำทาง
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export async function RoadsideCard({ latitude, longitude }: Props) {
  const nearby = await getNearbyRoadside(latitude, longitude);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">ปั๊มน้ำมันและจุดแวะพักรถใกล้เคียง</h2>

      {!nearby ? (
        <p className="text-sm text-muted">ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm text-muted">ปั๊มน้ำมัน</h3>
            <PoiList items={nearby.fuel} empty={`ไม่พบปั๊มน้ำมันในรัศมี ${nearby.radiusKm} กม.`} />
          </div>
          <div>
            <h3 className="mb-1 text-sm text-muted">จุดแวะพักรถ</h3>
            <PoiList
              items={nearby.restStops}
              empty={`ไม่พบจุดแวะพักรถในรัศมี ${nearby.radiusKm} กม.`}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        ระยะทางเป็นระยะเส้นตรง · ข้อมูลจาก{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </section>
  );
}

export function RoadsideCardSkeleton() {
  return (
    <section
      aria-busy="true"
      className="h-48 animate-pulse rounded-xl border border-border bg-surface motion-reduce:animate-none"
    >
      <span className="sr-only">กำลังโหลดปั๊มน้ำมันและจุดแวะพักรถ…</span>
    </section>
  );
}
