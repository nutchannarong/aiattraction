"use client";

import { AlertTriangle, ParkingSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass, Modal } from "@/components/ui/modal";
import { formatDistance } from "@/lib/geo";
import { minutesOf } from "@/lib/planner/edit";
import { describeParking } from "@/lib/planner/nearby";
import {
  COST_LABEL,
  type CostCategory,
  type PlanItem,
  type PlanItemKind,
  type PlanPlace,
} from "@/lib/planner/plan-types";
import { closedWarning } from "@/lib/planner/schedule";
import type { PlaceRef } from "@/lib/planner/types";
import { getPlaceDetails } from "./editor-actions";
import { NearbyPicker } from "./nearby-picker";
import { PlacePicker } from "./place-picker";

const ACTIVITY_TYPES: { kind: PlanItemKind; label: string; cost: CostCategory | null }[] = [
  { kind: "attraction", label: "เที่ยวชม", cost: "admission" },
  { kind: "meal", label: "กินข้าว / คาเฟ่", cost: "food" },
  { kind: "rest_stop", label: "แวะพักรถ", cost: null },
  { kind: "poi", label: "แวะซื้อของ / ธุระ", cost: "other" },
  { kind: "drive", label: "ขับรถ", cost: "travel" },
  { kind: "custom", label: "อื่น ๆ", cost: "other" },
];

export function toPlaceRef(p: PlanPlace): PlaceRef {
  return {
    type: p.source === "attraction" ? "attraction" : p.source === "pin" ? "pin" : "poi",
    id: p.id,
    label: p.name,
    sublabel: p.area ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
    isSecondaryCity: p.isSecondaryCity ?? null,
  };
}

export function fromPlaceRef(r: PlaceRef): PlanPlace {
  return {
    source:
      r.type === "attraction"
        ? "attraction"
        : r.type === "poi"
          ? "poi"
          : r.type === "pin" || r.type === "gps"
            ? "pin"
            : "place",
    id: r.id,
    name: r.label,
    area: r.sublabel ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    category: null,
    isSecondaryCity: r.isSecondaryCity ?? null,
  };
}

/** Add or edit one row of the daily plan. Mount with a `key` so each open starts fresh. */
export function ItemForm({
  open,
  onClose,
  initial,
  isNew,
  date,
  near,
  days,
  dayIndex,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: PlanItem;
  isNew: boolean;
  date: string;
  near: { lat: number; lng: number } | null;
  /** When set, the user can choose which day the item goes on. */
  days?: { index: number; label: string }[];
  dayIndex: number;
  onSave: (item: PlanItem, dayIndex: number) => void;
}) {
  const [item, setItem] = useState<PlanItem>(initial);
  const [day, setDay] = useState(dayIndex);
  const [showParking, setShowParking] = useState(false);
  const set = (patch: Partial<PlanItem>) => setItem((i) => ({ ...i, ...patch }));

  const warn = closedWarning(item.openingHours, date);
  const timeError =
    item.start && item.end && (minutesOf(item.end) ?? 0) <= (minutesOf(item.start) ?? 0)
      ? "เวลาสิ้นสุดต้องหลังเวลาเริ่ม"
      : null;
  const canSave = !timeError && (item.activity.trim() || item.place);

  const pickPlace = async (ref: PlaceRef | null) => {
    if (!ref) {
      set({ place: null });
      return;
    }
    const place = fromPlaceRef(ref);
    set({ place });
    if (!place.id || (place.source !== "attraction" && place.source !== "poi")) return;
    const details = await getPlaceDetails(place.source, place.id);
    if (!details) return;
    const isAttraction = place.source === "attraction";
    setItem((i) => ({
      ...i,
      kind: isAttraction && i.kind === "custom" ? "attraction" : i.kind,
      place: i.place && { ...i.place, category: details.category },
      phone: i.phone || details.phone,
      openingHours: i.openingHours || details.openingHours,
      costEstimate: i.costEstimate ?? (details.feeTh || null),
      costCategory: i.costCategory ?? (details.feeTh ? "admission" : null),
      activity: i.activity.trim()
        ? i.activity
        : details.kindLabel
          ? `${isAttraction ? "เที่ยว " : "แวะ"}${details.kindLabel}`
          : "",
    }));
  };

  const save = () => {
    onSave(
      { ...item, activity: item.activity.trim() || item.place?.name || "กิจกรรม", warning: warn },
      day,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "เพิ่มกิจกรรม" : "แก้ไขกิจกรรม"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {isNew ? "เพิ่มลงแผน" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {days && (
          <Field label="วันที่">
            <select
              className={inputClass}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {days.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="space-y-1">
          <p className="text-xs font-bold text-subtle">ประเภทกิจกรรม</p>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map((t) => (
              <Chip
                key={t.kind}
                pressed={item.kind === t.kind}
                tone="accent"
                className="min-h-9 px-3 text-xs"
                onClick={() => set({ kind: t.kind, costCategory: item.costCategory ?? t.cost })}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเริ่ม">
            <input
              type="time"
              className={inputClass}
              value={item.start ?? ""}
              onChange={(e) => set({ start: e.target.value || null })}
            />
          </Field>
          <Field label="ถึงเวลา">
            <input
              type="time"
              className={inputClass}
              value={item.end ?? ""}
              onChange={(e) => set({ end: e.target.value || null })}
            />
          </Field>
        </div>
        {timeError && <p className="text-xs font-semibold text-danger">{timeError}</p>}

        <Field label="กิจกรรม">
          <input
            className={inputClass}
            value={item.activity}
            maxLength={300}
            placeholder="เช่น ไหว้พระ ถ่ายรูป กินข้าวเที่ยง"
            onChange={(e) => set({ activity: e.target.value })}
          />
        </Field>

        <PlacePicker
          label="สถานที่ (พิมพ์ค้นหาแบบ Google แล้วดูแผนที่เล็กว่าเป็นที่เดียวกัน)"
          value={item.place ? toPlaceRef(item.place) : null}
          onChange={(ref) => void pickPlace(ref)}
          near={near}
          placeholder="ชื่อร้าน วัด ที่เที่ยว หรืออำเภอ"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ค่าใช้จ่ายโดยประมาณ (บาท รวมทุกคน)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputClass}
              value={item.costEstimate ?? ""}
              onChange={(e) =>
                set({
                  costEstimate: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
          <Field label="หมวดค่าใช้จ่าย">
            <select
              className={inputClass}
              value={item.costCategory ?? ""}
              onChange={(e) =>
                set({ costCategory: (e.target.value || null) as CostCategory | null })
              }
            >
              <option value="">ไม่ระบุ</option>
              {Object.entries(COST_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="วัน-เวลาเปิดปิด / ข้อจำกัด"
          hint="เช่น 08.00-17.00 น. หยุดวันจันทร์ · ระบบจะเตือนถ้าตรงวันหยุด"
        >
          <input
            className={inputClass}
            value={item.openingHours ?? ""}
            maxLength={500}
            onChange={(e) => set({ openingHours: e.target.value || null })}
          />
        </Field>
        {warn && (
          <p className="flex items-center gap-1 text-xs font-semibold text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" /> {warn}
          </p>
        )}

        <Field label="เบอร์โทร">
          <input
            type="tel"
            className={inputClass}
            value={item.phone ?? ""}
            maxLength={200}
            onChange={(e) => set({ phone: e.target.value || null })}
          />
        </Field>

        <div className="space-y-2">
          <Field label="ที่จอดรถแนะนำ">
            <input
              className={inputClass}
              value={item.parking ?? ""}
              maxLength={300}
              placeholder="เช่น ลานจอดวัด ฟรี"
              onChange={(e) => set({ parking: e.target.value || null })}
            />
          </Field>
          {item.place && (
            <Button
              variant="mini"
              onClick={() => setShowParking((v) => !v)}
              aria-expanded={showParking}
            >
              <ParkingSquare className="size-3.5" aria-hidden="true" />
              {showParking ? "ซ่อนที่จอดรถใกล้ ๆ" : "หาที่จอดรถใกล้สถานที่นี้"}
            </Button>
          )}
          {showParking && item.place && (
            <NearbyPicker
              categories={["parking"]}
              initialCategory="parking"
              center={{
                latitude: item.place.latitude,
                longitude: item.place.longitude,
                label: item.place.name,
              }}
              date={date}
              pickLabel="ใช้ที่จอดนี้"
              onPick={(p) => {
                set({
                  parking: [
                    describeParking(p),
                    p.unnamed ? null : p.place.name,
                    `ห่าง ${formatDistance(p.distanceM)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                });
                setShowParking(false);
              }}
            />
          )}
        </div>

        <Field label="โน้ต">
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            value={item.notes ?? ""}
            maxLength={2000}
            onChange={(e) => set({ notes: e.target.value || null })}
          />
        </Field>
      </div>
    </Modal>
  );
}
