import {
  Banknote,
  BedDouble,
  Coffee,
  Fuel,
  Hospital,
  Landmark,
  MapPin,
  Pill,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/** Map layers for places along the route, each with its own icon and colour. */
export type PoiCategory = {
  key: string;
  label: string;
  color: string;
  icon: LucideIcon;
  kinds: string[];
};

export const POI_CATEGORIES: PoiCategory[] = [
  {
    key: "restaurant",
    label: "ร้านอาหาร",
    color: "#C0472B",
    icon: Utensils,
    kinds: ["restaurant"],
  },
  { key: "cafe", label: "คาเฟ่", color: "#96662F", icon: Coffee, kinds: ["cafe"] },
  {
    key: "lodging",
    label: "ที่พัก",
    color: "#2E7FB8",
    icon: BedDouble,
    kinds: ["hotel", "resort", "guest_house", "hostel", "apartment", "motel"],
  },
  { key: "museum", label: "พิพิธภัณฑ์", color: "#6A5FA8", icon: Landmark, kinds: ["museum"] },
  { key: "atm", label: "ATM", color: "#149187", icon: Banknote, kinds: ["atm"] },
  { key: "fuel", label: "ปั๊มน้ำมัน", color: "#B7791F", icon: Fuel, kinds: ["fuel"] },
  { key: "pharmacy", label: "ร้านขายยา", color: "#3D8B4E", icon: Pill, kinds: ["pharmacy"] },
  {
    key: "hospital",
    label: "โรงพยาบาล / คลินิก",
    color: "#D6417A",
    icon: Hospital,
    kinds: ["hospital", "clinic"],
  },
  {
    key: "other",
    label: "จุดพักรถ · ห้องน้ำ · ที่จอดรถ",
    color: "#6B7078",
    icon: MapPin,
    kinds: ["rest_area", "services", "toilets", "parking"],
  },
];

export function poiCategoryOf(kind: string): PoiCategory {
  return (
    POI_CATEGORIES.find((c) => c.kinds.includes(kind)) ?? POI_CATEGORIES[POI_CATEGORIES.length - 1]
  );
}

/** Links to look a place up elsewhere (we don't copy reviews; we send people to the source). */
export function lookupLinks(name: string, area?: string | null, kind?: string | null) {
  const q = [name, area].filter(Boolean).join(" ");
  const links = [
    {
      label: "Google Maps",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    },
  ];
  if (kind === "restaurant" || kind === "cafe") {
    links.push({
      label: "LINE MAN Wongnai",
      href: `https://www.google.com/search?q=${encodeURIComponent(`site:wongnai.com ${q}`)}`,
    });
  }
  return links;
}

export function directionsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
