"use client";

import {
  Bike,
  Bus,
  Car,
  CarFront,
  Caravan,
  Loader2,
  MapPin,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Callout } from "@/components/ui/callout";
import { Chip } from "@/components/ui/chip";
import { StepGroup } from "@/components/ui/step-section";
import { Stepper } from "@/components/ui/stepper";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import { FUEL_TYPES, type FuelKey, type FuelPrice } from "@/lib/fuel";
import {
  ADULT_AGES,
  isOneWay,
  OCCASIONS,
  ROUTE_STYLES,
  STOP_KINDS,
  TRIP_TYPES,
  type PlaceGroupOption,
  type PlaceRef,
  type PlannerDraft,
  type VehicleType,
} from "@/lib/planner/types";
import { estimateEfficiency, VEHICLE_TYPES, vehicleTypeInfo } from "@/lib/planner/vehicles";
import { findRoutePlaceGroups, type RoutePlaceGroupsResult } from "./actions";
import { DateRangeCalendar } from "./date-range-calendar";
import { PlacePicker } from "./place-picker";

type StepProps = {
  draft: PlannerDraft;
  patch: (p: Partial<PlannerDraft>) => void;
};

const field =
  "min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none";

export function daysBetween(start: string, end: string) {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.round(ms / 86400000) + 1;
}

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

// ---------------------------------------------------------------------------
// 1 · จะไปไหน เมื่อไร
// ---------------------------------------------------------------------------
export function StepWhere({
  draft,
  patch,
  homeProvince,
  autoLocateOrigin = false,
}: StepProps & { homeProvince: PlaceRef | null; autoLocateOrigin?: boolean }) {
  const days = daysBetween(draft.startDate, draft.endDate);
  const today = todayIso();
  return (
    <>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <PlacePicker
          label="ออกเดินทางจาก"
          value={draft.origin}
          onChange={(origin) => patch({ origin })}
          autoLocate={autoLocateOrigin}
        />
        <PlacePicker
          label="จะไปที่ไหน"
          value={draft.destination}
          onChange={(destination) => patch({ destination })}
          near={draft.origin ? { lat: draft.origin.latitude, lng: draft.origin.longitude } : null}
          suggestions={
            homeProvince ? [{ label: `กลับบ้าน: ${homeProvince.label}`, place: homeProvince }] : []
          }
        />
      </div>
      <StepGroup title="ไป-กลับ หรือไปอย่างเดียว">
        <div className="flex flex-wrap gap-2" role="group" aria-label="รูปแบบการเดินทาง">
          {TRIP_TYPES.map((t) => (
            <Chip
              key={t.key}
              pressed={(draft.tripType ?? "round") === t.key}
              tone="accent"
              onClick={() => patch({ tripType: t.key })}
            >
              {t.label}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          {TRIP_TYPES.find((t) => t.key === (draft.tripType ?? "round"))?.hint}
        </p>
      </StepGroup>
      <StepGroup title="วันเดินทาง">
        <DateRangeCalendar
          start={draft.startDate}
          end={draft.endDate}
          today={today}
          endLabel={isOneWay(draft) ? "วันสุดท้ายของทริป" : "เดินทางกลับ"}
          onChange={({ startDate, endDate }) => patch({ startDate, endDate })}
        />
        {days > 14 && (
          <p className="mt-2 text-xs font-semibold text-danger">
            เลือกช่วงเดินทางไม่เกิน 14 วันก่อนดำเนินการต่อ
          </p>
        )}
      </StepGroup>
    </>
  );
}

export function whereSummary(d: PlannerDraft) {
  if (!d.origin || !d.destination) return "ยังไม่ได้เลือกต้นทางและปลายทาง";
  const days = daysBetween(d.startDate, d.endDate);
  const type = isOneWay(d) ? "ไปอย่างเดียว" : "ไป-กลับ";
  return `${d.origin.label} → ${d.destination.label} · ${type} · ${days} วัน`;
}

// ---------------------------------------------------------------------------
// 2 · เดินทางไปกับใคร
// ---------------------------------------------------------------------------
export function StepWho({ draft, patch }: StepProps) {
  const t = draft.travelers;
  const setT = (p: Partial<typeof t>) => patch({ travelers: { ...t, ...p } });
  return (
    <>
      <StepGroup title="จำนวนผู้เดินทาง">
        <Stepper
          label="ผู้ใหญ่"
          hint="อายุ 18–59 ปี"
          value={t.adults}
          max={60}
          onChange={(adults) => setT({ adults })}
        />
        <Stepper
          label="เด็ก"
          hint="อายุต่ำกว่า 18 ปี"
          value={t.children}
          max={40}
          onChange={(children) => setT({ children })}
        />
        <Stepper
          label="ผู้สูงอายุ"
          hint="อายุ 60 ปีขึ้นไป"
          value={t.seniors}
          max={40}
          onChange={(seniors) => setT({ seniors })}
        />
      </StepGroup>
      {t.adults > 0 && (
        <StepGroup title="ผู้ใหญ่อยู่ช่วงวัยไหน (เลือกได้หลายช่วง)">
          <div className="flex flex-wrap gap-2">
            {ADULT_AGES.map((a) => (
              <Chip
                key={a.key}
                tone="accent"
                pressed={t.adultAges.includes(a.key)}
                onClick={() => setT({ adultAges: toggle(t.adultAges, a.key) })}
                title={a.hint}
              >
                {a.label}
                <span className="font-normal opacity-80">· {a.hint}</span>
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            ระบบรวมความชอบของทุกช่วงวัยที่เลือก และจัดจังหวะให้เหมาะกับคนที่เดินไหวน้อยที่สุด
          </p>
        </StepGroup>
      )}
      <StepGroup title="โอกาสในการเดินทาง">
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Chip
              key={o.key}
              tone="secondary"
              pressed={draft.occasion === o.key}
              onClick={() => patch({ occasion: draft.occasion === o.key ? null : o.key })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </StepGroup>
      {t.adults + t.children + t.seniors === 0 && (
        <Callout tone="danger" className="mt-3">
          ต้องมีผู้เดินทางอย่างน้อย 1 คน
        </Callout>
      )}
    </>
  );
}

export function whoSummary(d: PlannerDraft) {
  const t = d.travelers;
  const total = t.adults + t.children + t.seniors;
  const parts = [
    `${total} คน`,
    t.adults && `ผู้ใหญ่ ${t.adults}`,
    t.children && `เด็ก ${t.children}`,
    t.seniors && `ผู้สูงอายุ ${t.seniors}`,
  ];
  const occasion = OCCASIONS.find((o) => o.key === d.occasion)?.label;
  return [parts.filter(Boolean).join(" · "), occasion].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// 3 · ไปแนวไหน (the "ไปกับใคร" sub-item from the prototype is removed on request)
// ---------------------------------------------------------------------------
export function StepInterests({
  draft,
  patch,
  groups,
}: StepProps & { groups: PlaceGroupOption[] }) {
  const [openGroup, setOpenGroup] = useState<string | null>(() => draft.interests[0] ?? null);
  const [routeResult, setRouteResult] = useState<{
    key: string;
    result: RoutePlaceGroupsResult;
  } | null>(null);
  const origin = draft.origin;
  const destination = draft.destination;
  const routeKey =
    origin && destination
      ? `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}:${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`
      : null;

  useEffect(() => {
    if (!routeKey || !origin || !destination) return;
    let cancelled = false;
    findRoutePlaceGroups({ origin, destination }).then((result) => {
      if (!cancelled) setRouteResult({ key: routeKey, result });
    });
    return () => {
      cancelled = true;
    };
  }, [routeKey, origin, destination]);

  const current = routeResult?.key === routeKey ? routeResult.result : null;
  const filteredGroups = useMemo(
    () => (current && "groups" in current ? current.groups : routeKey ? [] : groups),
    [current, groups, routeKey],
  );
  return (
    <>
      <StepGroup title="ไปแนวไหน — เลือกได้หลายแนว">
        {!routeKey && (
          <div className="mb-3 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
            เลือกต้นทางและปลายทางก่อน ระบบจะแสดงเฉพาะแนวท่องเที่ยวที่พบในพื้นที่ระหว่างทาง
          </div>
        )}
        {routeKey && !current && (
          <p className="mb-3 flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            กำลังกรองจังหวัดและสถานที่ใกล้แนวเดินทาง…
          </p>
        )}
        {current && "error" in current && (
          <Callout tone="danger" className="mb-3">
            {current.error}
          </Callout>
        )}
        {current && "groups" in current && (
          <div className="mb-3 rounded-lg bg-secondary-soft px-3 py-2 text-xs text-secondary">
            <p className="flex items-start gap-1.5 font-semibold">
              <MapPin className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
              กรองจากพื้นที่ใกล้แนวเดินทาง 50 กม. · พบ{current.total >= 500 ? "อย่างน้อย " : " "}
              {current.total.toLocaleString("th-TH")} แห่ง
            </p>
            {current.provinces.length > 0 && (
              <p className="mt-1 text-[11px] opacity-85">
                จังหวัดที่พบ: {current.provinces.join(" · ")}
              </p>
            )}
          </div>
        )}
        <div className="space-y-2">
          {filteredGroups.map((g) => {
            const on = draft.interests.includes(g.key);
            const picked = g.types.filter((t) => draft.interestTypes.includes(t.id)).length;
            return (
              <div
                key={g.key}
                className="overflow-hidden rounded-[13px] border-2 border-border bg-surface-3"
              >
                <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2.5 px-3 py-2">
                  <span
                    className="size-3.5 rounded border-[1.5px] border-foreground"
                    style={{ background: g.color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">
                    {g.label}
                    {g.effort === 2 && (
                      <span className="ml-1.5 text-xs font-normal text-subtle">· เดินเยอะ</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-subtle">
                    {g.total.toLocaleString("th-TH")}
                  </span>
                  <Toggle
                    label={`เลือกหมวด ${g.label}`}
                    hideLabel
                    checked={on}
                    onChange={(checked) =>
                      {
                        setOpenGroup(
                          checked
                            ? g.key
                            : openGroup === g.key
                              ? null
                              : openGroup,
                        );
                        patch({
                          interests: checked
                            ? [...draft.interests, g.key]
                            : draft.interests.filter((k) => k !== g.key),
                          interestTypes: checked
                            ? draft.interestTypes
                            : draft.interestTypes.filter((id) => !g.types.some((t) => t.id === id)),
                        });
                      }
                    }
                  />
                </div>
                {on && (
                  <div className="border-t-[1.5px] border-dashed border-border px-3 pb-3 pt-2">
                    <button
                      type="button"
                      className="min-h-9 text-xs font-semibold text-accent underline-offset-2 hover:underline"
                      aria-expanded={openGroup === g.key}
                      onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                    >
                      {openGroup === g.key
                        ? "ซ่อนประเภทย่อย"
                        : `เจาะจงประเภทย่อย${picked ? ` (${picked})` : ""}`}
                    </button>
                    {openGroup === g.key && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.types.map((t) => (
                          <Chip
                            key={t.id}
                            tone="secondary"
                            count={t.total}
                            pressed={draft.interestTypes.includes(t.id)}
                            onClick={() =>
                              patch({ interestTypes: toggle(draft.interestTypes, t.id) })
                            }
                            className="min-h-9 text-xs"
                          >
                            {t.label}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-subtle">
          เลือกอย่างน้อย 1 หมวด · ถ้าไม่ติ๊กประเภทย่อย ระบบจะนับสถานที่ทั้งหมวด
        </p>
      </StepGroup>
      <StepGroup title="การจัดแผน">
        <Toggle
          label="จัดแผนแบบสมดุลทุกวัย"
          hint="ไม่ให้หมวดใดเกิน 1 ใน 4 ของแผน และทุกวันมีอย่างน้อย 1 จุดที่เดินสบาย"
          checked={draft.balanced}
          onChange={(balanced) => patch({ balanced })}
        />
      </StepGroup>
    </>
  );
}

export function interestsSummary(d: PlannerDraft, groups: PlaceGroupOption[]) {
  if (d.interests.length === 0) return "ยังไม่เลือกแนวท่องเที่ยว";
  return groups
    .filter((g) => d.interests.includes(g.key))
    .map((g) => g.label.split(" · ")[0])
    .join(" · ");
}

// ---------------------------------------------------------------------------
// 4 · อยากแวะที่แบบไหน
// ---------------------------------------------------------------------------
export function StepStops({ draft, patch }: StepProps) {
  return (
    <>
      <StepGroup title="ประเภทจุดแวะที่อยากให้แสดงระหว่างทาง">
        <div className="flex flex-wrap gap-2">
          {STOP_KINDS.map((s) => (
            <Chip
              key={s.key}
              tone="accent"
              pressed={draft.stopKinds.includes(s.key)}
              onClick={() => patch({ stopKinds: toggle(draft.stopKinds, s.key) })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </StepGroup>
      {draft.stopKinds.includes("lodging") && (
        <Callout tone="info" className="mt-3" title="เปิดการเลือกที่พักและเทียบราคาแล้ว">
          <p>
            เมื่อสร้างร่างแผน แต่ละคืนจะมีปุ่ม “เลือกที่พัก” ให้ดูรายชื่อจาก OpenStreetMap
            แล้วเปิดเว็บจองเพื่อกรอกราคาที่ตรวจสอบได้
          </p>
          <p className="mt-1 font-semibold">
            Agoda · Booking.com · Trip.com · Traveloka · Expedia · Airbnb · จองตรง
          </p>
        </Callout>
      )}
      <Callout
        tone="info"
        className="mt-3"
        title="ข้อมูลร้าน ที่พัก และจุดบริการมาจาก OpenStreetMap"
      >
        ข้อมูลเปิด แก้ไขโดยอาสาสมัคร บางร้านอาจยังไม่มีในแผนที่ หรือเวลาเปิด-ปิดไม่ครบ
        ระบบไม่แต่งข้อมูลขึ้นมาเอง ทุกสถานที่ค้นหาต่อใน Google Maps ได้
        ส่วนร้านอาหารและคาเฟ่ค้นหาต่อใน LINE MAN Wongnai ได้
      </Callout>
    </>
  );
}

export function stopsSummary(d: PlannerDraft) {
  if (d.stopKinds.length === 0) return "ยังไม่เลือกจุดแวะ";
  return STOP_KINDS.filter((s) => d.stopKinds.includes(s.key))
    .map((s) => s.label)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// 5 · เดินทางด้วยอะไร + รูปแบบเส้นทาง
// ---------------------------------------------------------------------------
const VEHICLE_ICON: Record<VehicleType, LucideIcon> = {
  motorcycle: Bike,
  eco_car: Car,
  sedan: CarFront,
  suv: Caravan,
  pickup: Truck,
  van: Bus,
  bus: Bus,
};

export function StepVehicle({ draft, patch, fuelPrices }: StepProps & { fuelPrices: FuelPrice[] }) {
  const v = draft.vehicle;
  const info = vehicleTypeInfo(v.type);
  const setV = (p: Partial<typeof v>) => patch({ vehicle: { ...v, ...p } });
  const priceOf = (key: FuelKey) => fuelPrices.find((f) => f.key === key);
  const fuelInfo = priceOf(v.fuel);
  const estimate = estimateEfficiency(v);
  const unit = FUEL_TYPES.find((f) => f.key === v.fuel)?.unit ?? "ลิตร";
  const models = v.brand ? (info.brands[v.brand] ?? []) : [];
  const thisYear = new Date().getFullYear();

  const chooseType = (type: VehicleType) => {
    const next = vehicleTypeInfo(type);
    const fuel = next.fuels.includes(v.fuel) ? v.fuel : next.defaultFuel;
    setV({
      type,
      fuel,
      fuelPrice: priceOf(fuel)?.price ?? v.fuelPrice,
      brand: "",
      model: "",
      efficiencyOverride: null,
    });
  };

  return (
    <>
      <StepGroup title="ประเภทรถ">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {VEHICLE_TYPES.map((t) => {
            const Icon = VEHICLE_ICON[t.key];
            const on = v.type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => chooseType(t.key)}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center text-xs font-semibold",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface hover:border-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t.label}
                {!t.label.includes("ที่นั่ง") && (
                  <span className="font-normal opacity-75">{t.seats}</span>
                )}
              </button>
            );
          })}
        </div>
        {info.avoidMotorway && (
          <p className="mt-2 text-xs text-subtle">
            มอเตอร์ไซค์ขึ้นมอเตอร์เวย์ไม่ได้ตามกฎหมาย ระบบจะเลือกเส้นทางที่เลี่ยงมอเตอร์เวย์ให้
          </p>
        )}
      </StepGroup>

      <StepGroup title="รายละเอียดรถ">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium">ยี่ห้อ</span>
            <select
              className={field}
              value={v.brand}
              onChange={(e) => setV({ brand: e.target.value, model: "" })}
            >
              <option value="">ไม่ระบุ</option>
              {Object.keys(info.brands).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">รุ่น</span>
            <input
              className={field}
              list="vehicle-models"
              value={v.model}
              placeholder={models[0] ? `เช่น ${models.slice(0, 2).join(", ")}` : "พิมพ์รุ่นรถ"}
              onChange={(e) => setV({ model: e.target.value })}
            />
            <datalist id="vehicle-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">ขนาดเครื่องยนต์ (cc)</span>
            <input
              className={field}
              type="number"
              inputMode="numeric"
              min={50}
              max={16000}
              step={50}
              value={v.cc ?? ""}
              placeholder={String(info.defaultCc)}
              onChange={(e) =>
                setV({
                  cc: e.target.value ? Number(e.target.value) : null,
                  efficiencyOverride: null,
                })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">ปีของรถ</span>
            <input
              className={field}
              type="number"
              inputMode="numeric"
              min={1980}
              max={thisYear + 1}
              value={v.year ?? ""}
              placeholder={String(thisYear - 5)}
              onChange={(e) =>
                setV({
                  year: e.target.value ? Number(e.target.value) : null,
                  efficiencyOverride: null,
                })
              }
            />
          </label>
        </div>
      </StepGroup>

      <StepGroup title="เชื้อเพลิงและค่าน้ำมัน">
        <div className="flex flex-wrap gap-2">
          {info.fuels.map((key) => {
            const f = priceOf(key);
            return (
              <Chip
                key={key}
                tone="accent"
                pressed={v.fuel === key}
                onClick={() =>
                  setV({ fuel: key, fuelPrice: f?.price ?? v.fuelPrice, efficiencyOverride: null })
                }
              >
                {f?.label ?? key}
                {f && (
                  <span className="font-mono text-[11px] opacity-80">{f.price.toFixed(2)}</span>
                )}
              </Chip>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">ราคา (บาท/{unit})</span>
            <input
              className={cn(field, "font-mono")}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={v.fuelPrice}
              onChange={(e) => setV({ fuelPrice: Number(e.target.value) || 0 })}
            />
            <span className="block text-xs text-subtle">
              {fuelInfo?.source === "ptt"
                ? `ราคา ปตท. กรุงเทพฯ ${fuelInfo.date ? new Date(fuelInfo.date).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }) : "วันนี้"} · แก้ได้`
                : "ค่าตั้งต้น ไม่ใช่ราคาสด (ปตท. ไม่มีราคาชนิดนี้ หรือเรียกข้อมูลไม่ได้) · แก้ได้"}
            </span>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">อัตราสิ้นเปลือง (กม./{unit})</span>
            <input
              className={cn(field, "font-mono")}
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.1}
              value={v.efficiencyOverride ?? estimate}
              onChange={(e) => setV({ efficiencyOverride: Number(e.target.value) || null })}
            />
            <span className="block text-xs text-subtle">
              {v.efficiencyOverride
                ? "ค่าที่คุณกรอกเอง"
                : "ประมาณจากประเภทรถ ขนาดเครื่อง และปี · แก้ได้ถ้ารู้ค่าจริง"}
            </span>
          </label>
        </div>
      </StepGroup>

      <StepGroup title="รูปแบบเส้นทาง">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {ROUTE_STYLES.map((r, i) => {
            const on = draft.routeStyle === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ routeStyle: r.key })}
                className={cn(
                  "rounded-xl border-2 p-3 text-left",
                  on
                    ? "border-accent bg-accent-soft shadow-[3px_3px_0_var(--brand)]"
                    : "border-border bg-surface hover:border-foreground",
                )}
              >
                <span className="font-mono text-[11px] text-subtle">Option {i + 1}</span>
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{r.hint}</span>
              </button>
            );
          })}
        </div>
      </StepGroup>
    </>
  );
}

export function vehicleSummary(d: PlannerDraft) {
  const info = vehicleTypeInfo(d.vehicle.type);
  const car = [d.vehicle.brand, d.vehicle.model].filter(Boolean).join(" ");
  const style = ROUTE_STYLES.find((r) => r.key === d.routeStyle)?.label;
  return [info.label, car, style].filter(Boolean).join(" · ");
}
