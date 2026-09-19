"use client";

import { ExternalLink, Star, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass, Modal } from "@/components/ui/modal";
import { bookingLinks, nextDate, roomsFor } from "@/lib/planner/booking-links";
import type { NearbyPlace } from "@/lib/planner/nearby";
import {
  BOOKING_PLATFORMS,
  LODGING_FILTERS,
  LODGING_TYPES,
  PLATFORM_LABEL,
  type BookingPlatform,
  type LodgingDetail,
  type PlanItem,
  type PlanPlace,
} from "@/lib/planner/plan-types";
import { LODGING_TYPE_BY_KIND, newItem } from "@/lib/planner/schedule";
import type { PlannerDraft } from "@/lib/planner/types";
import { getPlaceDetails } from "./editor-actions";
import { fromPlaceRef } from "./item-form";
import { formatThaiDate } from "./day-plan";
import { NearbyPicker, type NearbyPoint } from "./nearby-picker";
import { PlacePicker } from "./place-picker";

const EMPTY_LODGING: LodgingDetail = {
  type: "hotel",
  minPrice: null,
  maxPrice: null,
  filters: ["parking"],
  prices: {},
  priceCheckedAt: {},
  platform: null,
  website: null,
  stars: null,
};

function numberOrNull(v: string) {
  return v === "" ? null : Math.max(0, Number(v));
}

/** Choose where to sleep for one night and compare prices across booking channels. */
export function LodgingPicker({
  open,
  onClose,
  initial,
  date,
  near,
  draft,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** The current lodging row, or null to add one. */
  initial: PlanItem | null;
  /** Check-in date. */
  date: string;
  near: NearbyPoint | null;
  draft: PlannerDraft;
  onSave: (item: PlanItem) => void;
}) {
  const [lodging, setLodging] = useState<LodgingDetail>(initial?.lodging ?? EMPTY_LODGING);
  const [place, setPlace] = useState<PlanPlace | null>(initial?.place ?? null);
  const [phone, setPhone] = useState<string | null>(initial?.phone ?? null);
  const [minStars, setMinStars] = useState<number | null>(null);
  const [mode, setMode] = useState<"nearby" | "search">("nearby");
  const [openedPlatform, setOpenedPlatform] = useState<BookingPlatform | null>(null);
  const set = (patch: Partial<LodgingDetail>) => setLodging((l) => ({ ...l, ...patch }));

  const { adults, children, seniors } = draft.travelers;
  const guests = adults + seniors;
  const checkOut = nextDate(date);
  const filter = useCallback(
    (p: NearbyPlace) => {
      const kinds = LODGING_TYPES.find((t) => t.key === lodging.type)?.osmKinds ?? [];
      return (
        kinds.includes(p.place.category ?? "") && (minStars == null || (p.stars ?? 0) >= minStars)
      );
    },
    [lodging.type, minStars],
  );

  const choose = (p: NearbyPlace) => {
    setPlace(p.place);
    setPhone(p.phone);
    set({
      website: p.website,
      stars: p.stars,
      type: LODGING_TYPE_BY_KIND[p.place.category ?? ""] ?? lodging.type,
    });
  };

  const links = place
    ? bookingLinks({
        name: place.name,
        area: place.area,
        checkIn: date,
        checkOut,
        adults: guests,
        children,
        lodging,
        phone,
      })
    : null;

  const prices = Object.values(lodging.prices).filter((n): n is number => n != null && n > 0);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const chosenPrice = lodging.platform ? lodging.prices[lodging.platform] : undefined;
  const estimate =
    chosenPrice ?? (prices.length ? Math.min(...prices) : (initial?.costEstimate ?? null));

  const save = () => {
    if (!place) return;
    const base =
      initial ??
      newItem({ kind: "lodging", activity: "เข้าที่พัก", start: "19:00", costCategory: "lodging" });
    onSave({
      ...base,
      kind: "lodging",
      place,
      phone,
      costEstimate: estimate,
      costCategory: "lodging",
      notes: `${roomsFor(guests, children)} ห้อง · ${guests + children} คน`,
      lodging: {
        ...lodging,
        booking: lodging.booking ?? { status: "todo", price: null, url: null, bookedAt: null },
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ที่พักคืนวัน${formatThaiDate(date)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={!place}>
            ใช้ที่พักนี้
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-bold text-subtle">ประเภทที่พัก</p>
          <div className="flex flex-wrap gap-1.5">
            {LODGING_TYPES.map((t) => (
              <Chip
                key={t.key}
                pressed={lodging.type === t.key}
                tone="accent"
                className="min-h-9 px-3 text-xs"
                onClick={() => set({ type: t.key })}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-bold text-subtle">
            ตัวกรอง (ส่งต่อไปยังเว็บจองเท่าที่เว็บรองรับ)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ราคาต่ำสุด / คืน">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputClass}
                value={lodging.minPrice ?? ""}
                onChange={(e) => set({ minPrice: numberOrNull(e.target.value) })}
              />
            </Field>
            <Field label="ราคาสูงสุด / คืน">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputClass}
                value={lodging.maxPrice ?? ""}
                onChange={(e) => set({ maxPrice: numberOrNull(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[null, 3, 4, 5].map((s) => (
              <Chip
                key={s ?? 0}
                pressed={minStars === s}
                className="min-h-9 px-3 text-xs"
                onClick={() => setMinStars(s)}
              >
                {s == null ? "ทุกระดับดาว" : `${s} ดาวขึ้นไป`}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LODGING_FILTERS.map((f) => (
              <Chip
                key={f.key}
                pressed={lodging.filters.includes(f.key)}
                tone="secondary"
                className="min-h-9 px-3 text-xs"
                onClick={() =>
                  set({
                    filters: lodging.filters.includes(f.key)
                      ? lodging.filters.filter((k) => k !== f.key)
                      : [...lodging.filters, f.key],
                  })
                }
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </section>

        {place ? (
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-2 rounded-xl border-2 border-foreground bg-surface-3 p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-display font-bold">
                  {place.name}
                  {lodging.stars != null && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-accent">
                      <Star className="size-3 fill-current" aria-hidden="true" />
                      {lodging.stars}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {[place.area, phone ? `โทร ${phone}` : null].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  เข้า {formatThaiDate(date)} · ออก {formatThaiDate(checkOut)} ·{" "}
                  {roomsFor(guests, children)} ห้อง · ผู้ใหญ่ {guests}
                  {children ? ` เด็ก ${children}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlace(null)}
                className="grid size-10 flex-none place-items-center rounded-full hover:bg-surface-2"
                aria-label="เปลี่ยนที่พัก"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="font-bold">ช่องทางจองและราคา</p>
              <p className="text-xs text-subtle">
                เปิดแต่ละเว็บ (ใส่ชื่อ วันที่ และจำนวนคนไว้ให้แล้ว)
                แล้วกรอกราคารวมทุกห้องต่อคืนที่เห็นเพื่อเปรียบเทียบ
                เราไม่มีราคาสดจากเว็บจองเหล่านี้
              </p>
            </div>
            <ul className="space-y-2">
              {BOOKING_PLATFORMS.map((p) => {
                const platformPrice = lodging.prices[p];
                const isCheapest =
                  platformPrice != null && platformPrice > 0 && platformPrice === cheapest;
                const checkedAt = lodging.priceCheckedAt?.[p];
                return (
                  <li
                    key={p}
                    className={`grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2 rounded-xl border-[1.5px] p-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_7.5rem] ${
                      isCheapest ? "border-secondary bg-secondary-soft" : "border-border"
                    }`}
                  >
                    <div>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name="platform"
                          className="size-4 accent-accent"
                          checked={lodging.platform === p}
                          onChange={() => set({ platform: p })}
                        />
                        {PLATFORM_LABEL[p]}
                        {isCheapest && <Badge tone="secondary">ถูกสุด</Badge>}
                      </label>
                      <p className="text-[11px] text-subtle">
                        {platformPrice == null
                          ? "ยังไม่ได้ตรวจสอบ"
                          : checkedAt
                            ? `ตรวจเมื่อ ${new Date(checkedAt).toLocaleString("th-TH", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}`
                            : "ราคาที่กรอกไว้"}
                      </p>
                    </div>
                    <a
                      href={links![p]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="col-span-2 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-info underline sm:col-span-1"
                      onClick={() => {
                        set({ platform: p });
                        setOpenedPlatform(p);
                      }}
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {p === "direct"
                        ? lodging.website
                          ? "เว็บไซต์ที่พัก"
                          : phone
                            ? "โทรจอง"
                            : "ค้นหาช่องทางจองตรง"
                        : `ค้นหาใน ${PLATFORM_LABEL[p]}`}
                    </a>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`ราคารวมทุกห้องต่อคืนใน ${PLATFORM_LABEL[p]}`}
                      placeholder="รวม/คืน"
                      className={`${inputClass} col-start-2 row-start-1 sm:col-start-3`}
                      value={lodging.prices[p] ?? ""}
                      onChange={(e) => {
                        const value = numberOrNull(e.target.value);
                        set({
                          prices: {
                            ...lodging.prices,
                            [p]: value ?? undefined,
                          },
                          priceCheckedAt: {
                            ...lodging.priceCheckedAt,
                            [p]: value == null ? undefined : new Date().toISOString(),
                          },
                          platform: value != null && lodging.platform == null ? p : lodging.platform,
                        });
                      }}
                    />
                    {openedPlatform === p && platformPrice == null && (
                      <p className="col-span-2 text-xs font-semibold text-accent sm:col-span-3">
                        กลับมาจาก {PLATFORM_LABEL[p]} แล้วกรอกราคารวมที่เห็นในช่องด้านขวา
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {prices.length > 1 && (
              <p className="text-xs text-secondary">
                ถูกสุด {cheapest!.toLocaleString("th-TH")} บาท/คืน · จากราคาที่คุณตรวจสอบเอง
              </p>
            )}
            {estimate != null && (
              <Badge tone="accent">ใช้คำนวณค่าที่พัก {estimate.toLocaleString("th-TH")} บาท</Badge>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                pressed={mode === "nearby"}
                onClick={() => setMode("nearby")}
                className="min-h-9 px-3 text-xs"
              >
                ที่พักแนะนำใกล้ ๆ
              </Chip>
              <Chip
                pressed={mode === "search"}
                onClick={() => setMode("search")}
                className="min-h-9 px-3 text-xs"
              >
                ค้นหาชื่อที่พัก
              </Chip>
            </div>
            {mode === "nearby" ? (
              <NearbyPicker
                categories={["lodging"]}
                initialCategory="lodging"
                center={near}
                date={date}
                pickLabel="เลือก"
                onPick={choose}
                filter={filter}
              />
            ) : (
              <PlacePicker
                label="ชื่อที่พัก"
                value={null}
                near={near ? { lat: near.latitude, lng: near.longitude } : null}
                placeholder="เช่น ชื่อโรงแรม รีสอร์ท หรืออำเภอ"
                onChange={async (ref) => {
                  if (!ref) return;
                  const p = fromPlaceRef(ref);
                  setPlace(p);
                  if (p.source === "poi" && p.id) {
                    const d = await getPlaceDetails("poi", p.id);
                    if (d) {
                      setPhone(d.phone);
                      set({ website: d.website });
                    }
                  }
                }}
              />
            )}
            <p className="text-xs text-subtle">
              ข้อมูลที่พักมาจาก OpenStreetMap ถ้าไม่เจอที่ต้องการ
              ค้นหาชื่ออำเภอแล้วเปิดเว็บจองเพื่อเลือกต่อได้
            </p>
          </section>
        )}
      </div>
    </Modal>
  );
}
