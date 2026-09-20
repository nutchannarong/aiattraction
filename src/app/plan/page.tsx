import type { Metadata } from "next";
import { getFuelPrices } from "@/lib/fuel";
import { getPlaceGroups } from "@/lib/place-groups";
import { defaultDraft } from "@/lib/planner/draft";
import type { AdultAge, PlaceRef } from "@/lib/planner/types";
import { ageFromBirthDate, getMyProfile } from "@/lib/profile";
import { getProvinces } from "@/lib/provinces";
import { Planner } from "./planner";

export const metadata: Metadata = { title: "วางแผนเที่ยว" };

// Drafting compares several route styles in one server action; give it room.
export const maxDuration = 60;

function ageBucket(age: number): AdultAge | null {
  if (age >= 18 && age <= 22) return "18-22";
  if (age >= 23 && age <= 30) return "23-30";
  if (age >= 31 && age <= 45) return "31-45";
  if (age >= 46 && age <= 59) return "46-59";
  return null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const params = await searchParams;
  const entry = params.new === "1" ? "new" : params.resume === "1" ? "resume" : "ask";
  const [groups, fuelPrices, profile, provinces] = await Promise.all([
    getPlaceGroups(),
    getFuelPrices(),
    getMyProfile(),
    getProvinces(),
  ]);

  const draft = defaultDraft();
  const fuel = fuelPrices.find((f) => f.key === draft.vehicle.fuel);
  if (fuel) draft.vehicle.fuelPrice = fuel.price;
  if (profile?.birth_date) {
    const bucket = ageBucket(ageFromBirthDate(profile.birth_date));
    if (bucket) draft.travelers.adultAges = [bucket];
  }

  const home = provinces.find((p) => p.id === profile?.home_province_id);
  const provinceRef = (name: string | undefined): PlaceRef | null => {
    const province = provinces.find((item) => item.name_th === name);
    if (!province || province.latitude == null || province.longitude == null) return null;
    return {
      type: "province",
      id: province.id,
      label: province.name_th,
      sublabel: province.region_th,
      latitude: province.latitude,
      longitude: province.longitude,
      provinceId: province.id,
      isSecondaryCity: province.is_secondary_city,
    };
  };
  const presetOrigin = provinceRef(first(params.from));
  const presetDestination = provinceRef(first(params.to));
  if (presetOrigin) draft.origin = presetOrigin;
  if (presetDestination) draft.destination = presetDestination;
  const homeProvince: PlaceRef | null =
    home && home.latitude != null && home.longitude != null
      ? {
          type: "province",
          id: home.id,
          label: home.name_th,
          sublabel: home.region_th,
          latitude: home.latitude,
          longitude: home.longitude,
          provinceId: home.id,
          isSecondaryCity: home.is_secondary_city,
        }
      : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-accent">วางแผนเที่ยว</p>
        <h1 className="text-[clamp(24px,3.6vw,34px)] font-extrabold leading-tight">
          บอกเราว่าไปไหน ไปกับใคร <span className="hl">ขับรถอะไร</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          ตอบ 5 ขั้นด้านล่าง ระบบจะร่างเส้นทาง จุดแวะ แผนรายวัน และค่าใช้จ่ายให้ ·
          คำตอบถูกเก็บในเครื่องนี้ ยังไม่ต้องเข้าสู่ระบบ
        </p>
      </div>
      <Planner
        initialDraft={draft}
        groups={groups}
        fuelPrices={fuelPrices}
        homeProvince={homeProvince}
        entry={entry}
        autoLocateOrigin={params.gps === "1"}
      />
    </div>
  );
}
