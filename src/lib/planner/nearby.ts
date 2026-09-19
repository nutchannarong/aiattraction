// Categories for "find something nearby" (เปลี่ยนแผน, add a rest stop, pick lodging).

import type { PlanItem, PlanPlace } from "./plan-types";

export const LODGING_KINDS = ["hotel", "resort", "guest_house", "hostel", "apartment", "motel"];

export type NearbyCategory = {
  key: string;
  label: string;
  /** OSM POI kinds; absent for attraction searches. */
  kinds?: string[];
  /** TAT attractions: null = any group, [] = the item's own group. */
  groups?: string[] | null;
};

export const NEARBY_CATEGORIES: NearbyCategory[] = [
  { key: "same", label: "ที่เที่ยวแนวเดียวกัน", groups: [] },
  { key: "attraction", label: "ที่เที่ยวทุกแนว", groups: null },
  { key: "restaurant", label: "ร้านอาหาร", kinds: ["restaurant"] },
  { key: "cafe", label: "คาเฟ่", kinds: ["cafe"] },
  { key: "fuel", label: "ปั๊มน้ำมัน", kinds: ["fuel"] },
  { key: "rest", label: "จุดพักรถ", kinds: ["rest_area", "services"] },
  { key: "toilets", label: "ห้องน้ำ", kinds: ["toilets"] },
  { key: "parking", label: "ที่จอดรถชั่วคราว", kinds: ["parking"] },
  { key: "lodging", label: "ที่พัก", kinds: LODGING_KINDS },
  { key: "museum", label: "พิพิธภัณฑ์", kinds: ["museum"] },
  { key: "health", label: "ร้านยา / โรงพยาบาล", kinds: ["pharmacy", "hospital", "clinic"] },
  { key: "atm", label: "ATM", kinds: ["atm"] },
];

export const REST_STOP_CATEGORIES = ["fuel", "cafe", "rest", "toilets", "parking"];

export function nearbyCategory(key: string) {
  return NEARBY_CATEGORIES.find((c) => c.key === key) ?? NEARBY_CATEGORIES[2];
}

/** The category to search when replacing an item with something similar. */
export function categoryForItem(item: PlanItem): string {
  const cat = item.place?.category;
  if (item.place?.source === "attraction") return "same";
  if (item.kind === "lodging") return "lodging";
  if (item.kind === "meal") return cat === "cafe" ? "cafe" : "restaurant";
  if (cat) {
    const found = NEARBY_CATEGORIES.find((c) => c.kinds?.includes(cat));
    if (found) return found.key;
  }
  if (item.kind === "rest_stop") return "fuel";
  return "attraction";
}

export type NearbyPlace = {
  place: PlanPlace;
  /** OSM has no name for it; `place.name` is a generic label. */
  unnamed?: boolean;
  kindLabel: string;
  distanceM: number;
  phone: string | null;
  openingHours: string | null;
  website: string | null;
  stars: number | null;
  /** Parking: null unknown, true paid, false free. */
  fee: boolean | null;
  subkind: string | null;
  feeTh: number | null;
  feeThKid: number | null;
};

const PARKING_TYPE: Record<string, string> = {
  surface: "ลานจอด",
  "multi-storey": "อาคารจอดรถ",
  underground: "ที่จอดใต้ดิน",
  rooftop: "จอดบนดาดฟ้า",
  street_side: "จอดริมถนน",
  lane: "จอดริมถนน",
  layby: "ช่องจอดริมทาง",
  carports: "ที่จอดมีหลังคา",
  sheds: "ที่จอดมีหลังคา",
  garage: "โรงจอดรถ",
};

/** "ลานจอด · ฟรี" style description of a parking POI. */
export function describeParking(p: Pick<NearbyPlace, "subkind" | "fee">) {
  const type = (p.subkind && PARKING_TYPE[p.subkind]) || "ที่จอดรถ";
  const fee = p.fee == null ? "ไม่ทราบค่าจอด" : p.fee ? "เสียค่าจอด" : "จอดฟรี";
  return `${type} · ${fee}`;
}
