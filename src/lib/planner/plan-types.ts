// The drafted trip returned by the planner and edited in the daily plan.

export type CostCategory = "fuel" | "travel" | "admission" | "food" | "lodging" | "other";

export const COST_LABEL: Record<CostCategory, string> = {
  fuel: "ค่าน้ำมัน",
  travel: "ค่าเดินทางอื่น (ทางด่วน/ที่จอด)",
  admission: "ค่าเข้าชม",
  food: "ค่าอาหาร",
  lodging: "ค่าที่พัก",
  other: "อื่น ๆ",
};

export type LodgingType =
  "dorm" | "apartment" | "daily_room" | "hourly_room" | "hotel" | "resort" | "other";

export const LODGING_TYPES: { key: LodgingType; label: string; osmKinds: string[] }[] = [
  { key: "dorm", label: "หอพัก / โฮสเทล", osmKinds: ["hostel"] },
  { key: "apartment", label: "อพาร์ตเมนต์", osmKinds: ["apartment"] },
  { key: "daily_room", label: "ห้องพักรายวัน / เกสต์เฮาส์", osmKinds: ["guest_house"] },
  { key: "hourly_room", label: "ห้องพักรายชั่วโมง / โมเต็ล", osmKinds: ["motel"] },
  { key: "hotel", label: "โรงแรม", osmKinds: ["hotel"] },
  { key: "resort", label: "รีสอร์ท", osmKinds: ["resort"] },
  {
    key: "other",
    label: "อื่น ๆ",
    osmKinds: ["hotel", "guest_house", "hostel", "motel", "apartment", "resort"],
  },
];

export type BookingPlatform = "agoda" | "booking" | "airbnb" | "direct";

export const PLATFORM_LABEL: Record<BookingPlatform, string> = {
  agoda: "Agoda",
  booking: "Booking.com",
  airbnb: "Airbnb",
  direct: "จองตรงกับที่พัก",
};

export type LodgingDetail = {
  type: LodgingType;
  minPrice: number | null;
  maxPrice: number | null;
  /** e.g. parking, breakfast, pets, pool */
  filters: string[];
  /** Price per night the user found on each platform (entered by the user). */
  prices: Partial<Record<BookingPlatform, number>>;
  platform: BookingPlatform | null;
  website: string | null;
  stars: number | null;
};

export type PlanPlace = {
  source: "attraction" | "poi" | "place" | "pin";
  id?: string;
  name: string;
  area?: string | null;
  latitude: number;
  longitude: number;
  /** place_groups key for attractions, OSM kind for POIs */
  category?: string | null;
  isSecondaryCity?: boolean | null;
};

export type PlanItemKind =
  "drive" | "attraction" | "poi" | "lodging" | "meal" | "rest_stop" | "custom";

export type PlanItem = {
  id: string;
  kind: PlanItemKind;
  /** "HH:MM" */
  start: string | null;
  end: string | null;
  activity: string;
  place: PlanPlace | null;
  costEstimate: number | null;
  costCategory: CostCategory | null;
  phone: string | null;
  openingHours: string | null;
  notes: string | null;
  /** e.g. "ปิดวันจันทร์" when the plan lands on a closed day */
  warning: string | null;
  lodging: LodgingDetail | null;
  driveKm?: number | null;
};

export type DayPlan = {
  index: number;
  date: string;
  title: string;
  items: PlanItem[];
  finished: boolean;
};

export type RoutePoi = {
  id: string;
  kind: string;
  subkind: string | null;
  name: string | null;
  brand: string | null;
  phone: string | null;
  openingHours: string | null;
  stars: number | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceM: number;
  routeFraction: number;
};

export type Candidate = {
  attId: string;
  name: string;
  nameEn: string | null;
  attType: number;
  groupKey: string;
  effort: number;
  typeLabel: string | null;
  province: string | null;
  district: string | null;
  isSecondaryCity: boolean;
  openingHours: string | null;
  feeTh: number | null;
  feeThKid: number | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  distanceM: number;
  routeFraction: number | null;
  score: number;
};

export type RouteLine = {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
};

export type TripPlan = {
  outbound: RouteLine;
  inbound: RouteLine | null;
  /** Extra points the route passes through (scenic/community stops or the user's own). */
  waypoints: PlanPlace[];
  days: DayPlan[];
  pois: RoutePoi[];
  /** More places near the route/destination the user can add. */
  suggestions: Candidate[];
  totals: {
    distanceKm: number;
    driveMin: number;
    stops: number;
    fuelUnits: number;
    fuelCost: number;
    admissionCost: number;
  };
  notes: string[];
  engine: "valhalla" | "osrm";
};
