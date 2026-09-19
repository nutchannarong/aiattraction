import type { FuelKey } from "../fuel";

/** A place picked in the planner: a province/district, a known place, a GPS fix or a map pin. */
export type PlaceRef = {
  type: "province" | "area" | "attraction" | "poi" | "gps" | "pin";
  id?: string;
  label: string;
  /** District/province or address, so same-named places can be told apart. */
  sublabel?: string | null;
  latitude: number;
  longitude: number;
  provinceId?: string | null;
  isSecondaryCity?: boolean | null;
};

export type AdultAge = "18-22" | "23-30" | "31-45" | "46-59";

export const ADULT_AGES: { key: AdultAge; label: string; hint: string }[] = [
  { key: "18-22", label: "18–22 ปี", hint: "วัยรุ่น วัยมหาวิทยาลัย" },
  { key: "23-30", label: "23–30 ปี", hint: "วัยทำงานเริ่มต้น" },
  { key: "31-45", label: "31–45 ปี", hint: "วัยสร้างครอบครัว" },
  { key: "46-59", label: "46–59 ปี", hint: "วัยมั่นคง มีครอบครัวแล้ว" },
];

export type Occasion = "couple" | "friends" | "family" | "parents" | "solo";

export const OCCASIONS: { key: Occasion; label: string }[] = [
  { key: "couple", label: "ไปกับคู่รัก" },
  { key: "friends", label: "ไปกับเพื่อน" },
  { key: "family", label: "ไปกับครอบครัว" },
  { key: "parents", label: "พาพ่อแม่ผู้สูงอายุเที่ยว" },
  { key: "solo", label: "เที่ยวคนเดียว" },
];

export type Travelers = {
  adults: number;
  children: number;
  seniors: number;
  adultAges: AdultAge[];
};

export type StopKind =
  | "restaurant"
  | "cafe"
  | "lodging"
  | "temple"
  | "attraction"
  | "rest_area"
  | "fuel"
  | "toilets"
  | "parking"
  | "atm"
  | "health"
  | "other";

export const STOP_KINDS: { key: StopKind; label: string }[] = [
  { key: "restaurant", label: "ร้านอาหาร" },
  { key: "cafe", label: "คาเฟ่" },
  { key: "lodging", label: "ที่พัก" },
  { key: "temple", label: "วัด" },
  { key: "attraction", label: "แหล่งท่องเที่ยว" },
  { key: "rest_area", label: "จุดพักรถ" },
  { key: "fuel", label: "ปั๊มน้ำมัน" },
  { key: "toilets", label: "ห้องน้ำ" },
  { key: "parking", label: "ที่จอดรถ" },
  { key: "atm", label: "ATM" },
  { key: "health", label: "ร้านขายยา / โรงพยาบาล" },
  { key: "other", label: "อื่น ๆ" },
];

export type VehicleType = "motorcycle" | "eco_car" | "sedan" | "suv" | "pickup" | "van" | "bus";

export type Vehicle = {
  type: VehicleType;
  brand: string;
  model: string;
  cc: number | null;
  year: number | null;
  fuel: FuelKey;
  /** Price per unit (litre, kg or kWh). */
  fuelPrice: number;
  /** km per unit; null means use the estimate. */
  efficiencyOverride: number | null;
};

export type RouteStyle = "fastest" | "scenic" | "community" | "mixed" | "custom";

export const ROUTE_STYLES: { key: RouteStyle; label: string; hint: string }[] = [
  { key: "fastest", label: "เส้นทางหลัก เน้นเร็วที่สุด", hint: "ใช้ทางหลวงสายหลักและมอเตอร์เวย์" },
  {
    key: "scenic",
    label: "เน้นชมวิวธรรมชาติ",
    hint: "เลี่ยงมอเตอร์เวย์ ผ่านจุดชมวิว ภูเขา น้ำตก ทะเล",
  },
  { key: "community", label: "เส้นทางชุมชน", hint: "เลี่ยงมอเตอร์เวย์ แวะชุมชน ตลาด ฟาร์ม" },
  {
    key: "mixed",
    label: "ผสมผสาน (หลัก + ชุมชน)",
    hint: "ใช้ทางหลักเป็นแกน แวะชุมชนวันละ 1–2 จุด",
  },
  { key: "custom", label: "กำหนดเอง", hint: "ลากจุดผ่านบนแผนที่ได้อิสระ" },
];

export type LatLng = { lat: number; lng: number };

/** Round trip plans the drive home on the last day; one-way ends at the destination. */
export type TripType = "round" | "one_way";

export const TRIP_TYPES: { key: TripType; label: string; hint: string }[] = [
  { key: "round", label: "ไป-กลับ", hint: "วันสุดท้ายขับกลับจุดเริ่มต้น" },
  { key: "one_way", label: "ไปอย่างเดียว", hint: "จบทริปที่ปลายทาง ไม่คิดขากลับ" },
];

export function isOneWay(d: Pick<PlannerDraft, "tripType">) {
  return d.tripType === "one_way";
}

export type PlannerDraft = {
  version: 1;
  origin: PlaceRef | null;
  destination: PlaceRef | null;
  /** Missing on drafts saved before this option existed: treat as round trip. */
  tripType?: TripType;
  startDate: string;
  /** Round trip: the day you drive home. One-way: the last day of the trip. */
  endDate: string;
  travelers: Travelers;
  occasion: Occasion | null;
  travelPurpose?: "holiday" | "festival" | "homecoming" | "celebration" | "leisure" | null;
  /** place_groups keys */
  interests: string[];
  /** att_type ids chosen inside the interest groups; empty = whole group */
  interestTypes: number[];
  balanced: boolean;
  stopKinds: StopKind[];
  vehicle: Vehicle;
  routeStyle: RouteStyle;
  customWaypoints: LatLng[];
};

export type PlaceGroupOption = {
  key: string;
  label: string;
  color: string;
  effort: number;
  total: number;
  types: { id: number; label: string; total: number }[];
};
