"use client";

import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  CheckCircle2,
  Coffee,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, Modal } from "@/components/ui/modal";
import {
  addMinutes,
  firstGap,
  insertByTime,
  moveItem,
  nextStart,
  orderDayItems,
  placeBefore,
  replaceItem,
  updateDay,
} from "@/lib/planner/edit";
import {
  categoryForItem,
  NEARBY_CATEGORIES,
  REST_STOP_CATEGORIES,
  type NearbyPlace,
} from "@/lib/planner/nearby";
import type { DayPlan, PlanItem, PlanPlace, TripPlan } from "@/lib/planner/plan-types";
import { admissionFor, closedWarning, newItem } from "@/lib/planner/schedule";
import type { PlannerDraft } from "@/lib/planner/types";
import { DayCostTotal, formatThaiDate, ItemRow } from "./day-plan";
import { ItemForm } from "./item-form";
import { LodgingPicker } from "./lodging-picker";
import { NearbyPicker, type NearbyPoint } from "./nearby-picker";

const DailyPlanMap = dynamic(() => import("@/components/daily-plan-map"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-surface-2 motion-reduce:animate-none sm:h-72" />,
});

export type AddRequest = { key: number; item: PlanItem; dayIndex: number };

type ModalState =
  | { type: "item"; dayIndex: number; item: PlanItem; isNew: boolean; pickDay?: boolean }
  | { type: "replan"; dayIndex: number; item: PlanItem }
  | { type: "rest"; dayIndex: number }
  | { type: "lodging"; dayIndex: number; item: PlanItem | null };

const iconButton =
  "grid size-9 place-items-center rounded-lg border-[1.5px] border-border bg-surface hover:border-foreground disabled:opacity-40";

function pointOf(place: PlanPlace | null): NearbyPoint | null {
  return place ? { latitude: place.latitude, longitude: place.longitude, label: place.name } : null;
}

/** Replace an item's place with one found nearby, keeping its time slot. */
function replanItem(item: PlanItem, p: NearbyPlace, date: string, draft: PlannerDraft): PlanItem {
  const isAttraction = p.place.source === "attraction";
  const fee = isAttraction ? admissionFor({ feeTh: p.feeTh, feeThKid: p.feeThKid }, draft) : 0;
  const lodgingKind = item.kind === "lodging";
  return {
    ...item,
    kind: lodgingKind
      ? "lodging"
      : isAttraction
        ? "attraction"
        : item.kind === "attraction"
          ? "poi"
          : item.kind,
    activity: isAttraction
      ? `เที่ยว ${p.kindLabel}`
      : item.kind === "attraction"
        ? `แวะ${p.kindLabel}`
        : item.activity,
    place: p.place,
    phone: p.phone,
    openingHours: p.openingHours,
    warning: closedWarning(p.openingHours, date),
    costEstimate: isAttraction ? fee || null : item.costEstimate,
    costCategory: isAttraction ? (fee ? "admission" : null) : item.costCategory,
    notes: `เปลี่ยนแผนจาก ${item.place?.name ?? item.activity}`,
    lodging: item.lodging && { ...item.lodging, website: p.website, stars: p.stars },
  };
}

export function DayEditor({
  draft,
  plan,
  onChange,
  addRequest,
  onAddRequestDone,
}: {
  draft: PlannerDraft;
  plan: TripPlan;
  onChange: (plan: TripPlan) => void;
  /** An item to add from outside (map pin or suggestion card). */
  addRequest: AddRequest | null;
  onAddRequestDone: () => void;
}) {
  const [local, setLocal] = useState<ModalState | null>(null);
  const [restAfter, setRestAfter] = useState<number | null>(null);
  const [inlineReplan, setInlineReplan] = useState<{ dayIndex: number; item: PlanItem } | null>(null);
  const [replanCandidates, setReplanCandidates] = useState<NearbyPlace[]>([]);
  const modal: ModalState | null = addRequest
    ? {
        type: "item",
        dayIndex: addRequest.dayIndex,
        item: addRequest.item,
        isNew: true,
        pickDay: true,
      }
    : local;
  const close = () => {
    if (addRequest) onAddRequestDone();
    setLocal(null);
    setRestAfter(null);
    setInlineReplan(null);
    setReplanCandidates([]);
  };
  const dayOf = (index: number) => plan.days.find((d) => d.index === index) ?? plan.days[0];
  const edit = (dayIndex: number, fn: (day: DayPlan) => DayPlan) =>
    onChange(
      updateDay(plan, dayIndex, (day) => orderDayItems(fn(orderDayItems(day)))),
    );
  const dayOptions = plan.days.map((d) => ({
    index: d.index,
    label: `วันที่ ${d.index + 1} · ${formatThaiDate(d.date)}`,
  }));

  const modalDay = modal ? dayOf(modal.dayIndex) : null;
  const modalNear = modalDay ? placeBefore(modalDay) : null;

  return (
    <div className="space-y-5">
      {plan.days.map((sourceDay) => {
        const day = orderDayItems(sourceDay);
        const previousDay = plan.days.find((candidate) => candidate.index === day.index - 1);
        const previousPlace = previousDay
          ? orderDayItems(previousDay).items.toReversed().find((item) => item.place)?.place ?? null
          : null;
        const mapStart =
          day.index === 0 && draft.origin
            ? {
                source: "place" as const,
                name: draft.origin.label,
                latitude: draft.origin.latitude,
                longitude: draft.origin.longitude,
              }
            : previousPlace;
        const hasLodging = day.items.some((i) => i.kind === "lodging");
        const needsLodging = day.index < plan.days.length - 1 && !hasLodging;
        const replanning = inlineReplan?.dayIndex === day.index ? inlineReplan : null;
        const pickReplacement = (candidateId: string) => {
          const candidate = replanCandidates.find(
            (place) => `${place.place.source}:${place.place.id}` === candidateId,
          );
          if (!candidate) return;
          edit(day.index, (d) => replaceItem(d, replanItem(replanning!.item, candidate, d.date, draft)));
          setInlineReplan(null);
          setReplanCandidates([]);
        };
        return (
          <section
            key={day.index}
            id={`day-${day.index}`}
            className="scroll-mt-24 overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard"
          >
            <header className="flex flex-wrap items-center gap-2.5 border-b-2 border-foreground bg-surface-2 px-4 py-3">
              <span className="rounded-full border-2 border-foreground bg-accent px-3 py-0.5 font-display text-sm font-bold text-white dark:text-black">
                วันที่ {day.index + 1}
              </span>
              <span className="text-sm font-semibold">{day.title}</span>
              <span className="text-xs text-subtle">{formatThaiDate(day.date)}</span>
              {day.finished && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" /> จบกิจกรรมแล้ว
                </span>
              )}
              <DayCostTotal day={day} />
            </header>

            {!day.finished && (
              <div className="flex flex-wrap items-center gap-2 border-b-[1.5px] border-dashed border-border bg-surface-3 px-4 py-2.5">
                <Button
                  variant="mini"
                  onClick={() =>
                    setLocal({
                      type: "item",
                      dayIndex: day.index,
                      isNew: true,
                      item: newItem({
                        kind: "attraction",
                        activity: "",
                        start: firstGap(day),
                        end: addMinutes(firstGap(day), 60),
                      }),
                    })
                  }
                >
                  <Plus className="size-3.5" aria-hidden="true" /> เพิ่มกิจกรรม
                </Button>
                <Button
                  variant="mini"
                  onClick={() => setLocal({ type: "rest", dayIndex: day.index })}
                >
                  <Coffee className="size-3.5" aria-hidden="true" /> แวะพักรถ
                </Button>
                {day.index < plan.days.length - 1 && (
                  <Button
                    variant="mini"
                    onClick={() =>
                      setLocal({
                        type: "lodging",
                        dayIndex: day.index,
                        item: day.items.find((i) => i.kind === "lodging") ?? null,
                      })
                    }
                  >
                    <BedDouble className="size-3.5" aria-hidden="true" />
                    {hasLodging ? "เปลี่ยนที่พัก" : "เลือกที่พัก"}
                  </Button>
                )}
                {needsLodging && (
                  <span className="text-xs font-semibold text-danger">ยังไม่มีที่พักคืนนี้</span>
                )}
                <span className="text-xs text-subtle">
                  รายการที่มีเวลาจะเรียงอัตโนมัติ · แก้เวลาเพื่อเปลี่ยนลำดับ
                </span>
              </div>
            )}

            <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
              <div id={`day-items-${day.index}`} className="min-w-0 lg:border-r-[1.5px] lg:border-border">
                <ul className="px-4 py-1">
                  {day.items.length === 0 && (
                    <li className="py-4 text-sm text-subtle">
                      ยังไม่มีกิจกรรม กด “เพิ่มกิจกรรม” เพื่อเริ่ม
                    </li>
                  )}
                  {day.items.map((item, idx) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      actions={
                        day.finished || item.kind === "drive" ? null : (
                          <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={iconButton}
                          aria-label={`แก้ไข ${item.place?.name ?? item.activity}`}
                          title="แก้ไข"
                          onClick={() =>
                            setLocal(
                              item.kind === "lodging"
                                ? { type: "lodging", dayIndex: day.index, item }
                                : { type: "item", dayIndex: day.index, item, isNew: false },
                            )
                          }
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`${iconButton} w-auto gap-1 px-2 text-xs font-semibold`}
                          title="หาที่ใกล้เคียงแทน เช่น เมื่อร้านปิด"
                          onClick={() => {
                            setReplanCandidates([]);
                            setInlineReplan({ dayIndex: day.index, item });
                          }}
                        >
                          <Shuffle className="size-4" aria-hidden="true" /> เปลี่ยนแผน
                        </button>
                        {!item.start && (
                          <>
                            <button
                              type="button"
                              className={iconButton}
                              aria-label="เลื่อนขึ้น"
                              disabled={idx === 0}
                              onClick={() => edit(day.index, (d) => moveItem(d, item.id, -1))}
                            >
                              <ArrowUp className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              aria-label="เลื่อนลง"
                              disabled={idx === day.items.length - 1}
                              onClick={() => edit(day.index, (d) => moveItem(d, item.id, 1))}
                            >
                              <ArrowDown className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className={`${iconButton} text-danger`}
                          aria-label={`ลบ ${item.place?.name ?? item.activity}`}
                          onClick={() => {
                            if (
                              window.confirm(`ลบ “${item.place?.name ?? item.activity}” ออกจากแผน?`)
                            ) {
                              edit(day.index, (d) => ({
                                ...d,
                                items: d.items.filter((i) => i.id !== item.id),
                              }));
                            }
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                          </div>
                        )
                      }
                    />
                  ))}
                </ul>
              </div>

              <aside className="flex min-w-0 flex-col border-t-[1.5px] border-border bg-surface-3 lg:border-t-0">
                {replanning && (
                  <div className="flex items-center border-b border-border px-4 py-2 text-xs font-semibold">
                    เลือกจุดใหม่บนแผนที่
                    <button
                      type="button"
                      className="ml-auto text-info underline"
                      onClick={() => {
                        setInlineReplan(null);
                        setReplanCandidates([]);
                      }}
                    >
                      กลับสู่แผนเดิม
                    </button>
                  </div>
                )}
                <DailyPlanMap
                  day={day}
                  start={mapStart}
                  alternatives={
                    replanning && replanCandidates.length > 0
                      ? replanCandidates.map((candidate) => ({
                          id: `${candidate.place.source}:${candidate.place.id}`,
                          name: candidate.place.name,
                          latitude: candidate.place.latitude,
                          longitude: candidate.place.longitude,
                        }))
                      : undefined
                  }
                  onSelectAlternative={replanning ? pickReplacement : undefined}
                  className={replanning ? "lg:h-72 lg:flex-none" : "h-72 lg:h-[36rem]"}
                  matchHeightTo={replanning ? undefined : `day-items-${day.index}`}
                />
                {replanning && (
                  <div className="max-h-[32rem] touch-pan-y overflow-y-auto overscroll-contain border-t border-border p-3">
                    <p className="mb-2 text-xs text-subtle">
                      เลือกจุดที่ใกล้เคียงแทน “{replanning.item.place?.name ?? replanning.item.activity}”
                    </p>
                    <NearbyPicker
                      categories={NEARBY_CATEGORIES.map((c) => c.key).filter(
                        (key) => key !== "same" || replanning.item.place?.source === "attraction",
                      )}
                      initialCategory={categoryForItem(replanning.item)}
                      center={pointOf(
                        replanning.item.place ?? placeBefore(day, day.items.indexOf(replanning.item)),
                      )}
                      group={replanning.item.place?.source === "attraction" ? replanning.item.place.category : null}
                      excludeId={replanning.item.place?.id ?? null}
                      date={day.date}
                      pickLabel="ใช้ที่นี่แทน"
                      onResultsChange={setReplanCandidates}
                      onPick={(place) => {
                        edit(day.index, (d) => replaceItem(d, replanItem(replanning.item, place, d.date, draft)));
                        setInlineReplan(null);
                        setReplanCandidates([]);
                      }}
                    />
                  </div>
                )}
              </aside>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-foreground bg-surface-2 px-4 py-3">
              {day.finished ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> บันทึกวันนี้แล้ว
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => edit(day.index, (d) => ({ ...d, finished: false }))}
                  >
                    แก้ไขวันนี้อีกครั้ง
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-subtle">
                    จัดกิจกรรมครบแล้ว กดจบเพื่อบันทึกวันนี้และรวมเข้าสรุปค่าใช้จ่าย
                  </p>
                  <Button
                    variant="ink"
                    onClick={() => {
                      edit(day.index, (d) => ({ ...d, finished: true }));
                      document
                        .getElementById(`day-${day.index + 1}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" /> จบกิจกรรมวันนี้
                  </Button>
                </>
              )}
            </footer>
          </section>
        );
      })}

      {modal?.type === "item" && modalDay && (
        <ItemForm
          key={modal.item.id}
          open
          onClose={close}
          initial={modal.item}
          isNew={modal.isNew}
          date={modalDay.date}
          near={modalNear ? { lat: modalNear.latitude, lng: modalNear.longitude } : null}
          days={modal.pickDay ? dayOptions : undefined}
          dayIndex={modal.dayIndex}
          onSave={(item, dayIndex) => {
            if (modal.isNew) {
              edit(dayIndex, (d) => ({
                ...d,
                finished: false,
                items: insertByTime(d.items, item),
              }));
            } else {
              edit(dayIndex, (d) => replaceItem(d, item));
            }
            close();
          }}
        />
      )}

      {modal?.type === "replan" && modalDay && (
        <Modal
          open
          onClose={close}
          title={`เปลี่ยนแผน: ${modal.item.place?.name ?? modal.item.activity}`}
        >
          <p className="mb-3 text-sm text-muted">
            ที่เดิมปิดหรือไม่สะดวก? เลือกที่ใกล้ ๆ ประเภทเดียวกันแทน โดยค้นจากตำแหน่งของรายการนี้
            หรือจากตำแหน่งปัจจุบันของคุณ (GPS) เวลาในแผนยังเหมือนเดิม
          </p>
          <NearbyPicker
            categories={NEARBY_CATEGORIES.map((c) => c.key).filter(
              (k) => k !== "same" || modal.item.place?.source === "attraction",
            )}
            initialCategory={categoryForItem(modal.item)}
            center={pointOf(
              modal.item.place ?? placeBefore(modalDay, modalDay.items.indexOf(modal.item)),
            )}
            group={modal.item.place?.source === "attraction" ? modal.item.place.category : null}
            excludeId={modal.item.place?.id ?? null}
            date={modalDay.date}
            pickLabel="ใช้ที่นี่แทน"
            onPick={(p) => {
              edit(modal.dayIndex, (d) => replaceItem(d, replanItem(modal.item, p, d.date, draft)));
              close();
            }}
          />
        </Modal>
      )}

      {modal?.type === "rest" && modalDay && (
        <Modal open onClose={close} title="เพิ่มจุดแวะพักรถ">
          {(() => {
            const lastDrive = modalDay.items.map((i) => i.kind).lastIndexOf("drive");
            const after = restAfter ?? (lastDrive >= 0 ? lastDrive : modalDay.items.length - 1);
            return (
              <div className="space-y-3">
                {modalDay.items.length > 0 && (
                  <Field label="แวะหลังรายการ">
                    <select
                      className={inputClass}
                      value={after}
                      onChange={(e) => setRestAfter(Number(e.target.value))}
                    >
                      {modalDay.items.map((i, k) => (
                        <option key={i.id} value={k}>
                          {i.start ?? "--:--"} {i.place?.name ?? i.activity}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <NearbyPicker
                  key={after}
                  categories={REST_STOP_CATEGORIES}
                  initialCategory="fuel"
                  center={pointOf(placeBefore(modalDay, after))}
                  date={modalDay.date}
                  pickLabel="แวะที่นี่"
                  onPick={(p) => {
                    const start = nextStart(modalDay, after);
                    const item = newItem({
                      kind: "rest_stop",
                      activity:
                        p.place.category === "fuel"
                          ? "แวะเติมน้ำมัน เข้าห้องน้ำ"
                          : p.place.category === "cafe"
                            ? "แวะพักดื่มกาแฟ"
                            : p.place.category === "parking"
                              ? "จอดพักรถชั่วคราว"
                              : "แวะพัก เข้าห้องน้ำ",
                      start,
                      end: addMinutes(start, 20),
                      place: p.place,
                      phone: p.phone,
                      openingHours: p.openingHours,
                      warning: closedWarning(p.openingHours, modalDay.date),
                    });
                    edit(modal.dayIndex, (d) => ({
                      ...d,
                      items: insertByTime(d.items, item, Math.min(after, d.items.length - 1)),
                    }));
                    close();
                  }}
                />
              </div>
            );
          })()}
        </Modal>
      )}

      {modal?.type === "lodging" && modalDay && (
        <LodgingPicker
          key={modal.item?.id ?? `new-${modal.dayIndex}`}
          open
          onClose={close}
          initial={modal.item}
          date={modalDay.date}
          near={pointOf(modal.item?.place ?? placeBefore(modalDay))}
          draft={draft}
          onSave={(item) => {
            edit(modal.dayIndex, (d) =>
              d.items.some((i) => i.id === item.id)
                ? replaceItem(d, item)
                : { ...d, items: [...d.items, item] },
            );
            close();
          }}
        />
      )}
    </div>
  );
}
