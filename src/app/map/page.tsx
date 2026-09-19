import Link from "next/link";
import { RoutePlannerMap } from "@/components/route-planner-map";
import { getAttraction, searchAttractions } from "@/lib/attractions";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const destinationId = Array.isArray(params.destination)
    ? params.destination[0]
    : params.destination;
  const [result, destination] = await Promise.all([
    searchAttractions({ page: 1 }),
    destinationId ? getAttraction(destinationId) : Promise.resolve(null),
  ]);
  const attractions = result.items
    .filter((attraction) => attraction.latitude != null && attraction.longitude != null)
    .map((attraction) => ({
      id: attraction.att_id,
      name: attraction.att_name_th,
      latitude: attraction.latitude!,
      longitude: attraction.longitude!,
      typeLabel: attraction.att_type_label,
      province: attraction.province_name_th,
    }));
  const destinationItem =
    destination && destination.latitude != null && destination.longitude != null
      ? {
          id: destination.att_id,
          name: destination.att_name_th,
          latitude: destination.latitude,
          longitude: destination.longitude,
          typeLabel: destination.att_type_label,
          province: destination.province_name_th,
        }
      : null;
  const items = destinationItem
    ? [destinationItem, ...attractions.filter((item) => item.id !== destinationItem.id)]
    : attractions;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-accent">AI Attraction</p>
          <h1 className="text-2xl font-bold">แผนที่แหล่งท่องเที่ยว</h1>
          <p className="mt-1 text-sm text-muted">
            แสดงสถานที่จากผลลัพธ์หน้าแรกจำนวน {items.length} แห่ง
          </p>
        </div>
        <Link href="/" className="text-sm text-accent">
          ← กลับไปหน้าค้นหา
        </Link>
      </div>

      <RoutePlannerMap
        attractions={items}
        className="h-[calc(100vh-18rem)] min-h-[32rem]"
      />

      <p className="text-xs text-muted">
        แผนที่และข้อมูลแผนที่จาก OpenStreetMap contributors
      </p>
    </div>
  );
}
