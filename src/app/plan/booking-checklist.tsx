"use client";

import { CheckCircle2, CircleDashed, ExternalLink, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass, Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { bookingLinks, nextDate } from "@/lib/planner/booking-links";
import { replaceItem, updateDay } from "@/lib/planner/edit";
import {
  BOOKING_STATUS_LABEL,
  PLATFORM_LABEL,
  type BookingPlatform,
  type BookingState,
  type DayPlan,
  type PlanItem,
  type TripPlan,
} from "@/lib/planner/plan-types";
import type { PlannerDraft } from "@/lib/planner/types";
import { baht, formatThaiDate } from "./day-plan";

const PLATFORMS: BookingPlatform[] = ["agoda", "booking", "airbnb", "direct"];

type Night = { n: number; day: DayPlan; item: PlanItem | null };

function nightsOf(plan: TripPlan): Night[] {
  const days = plan.days.length > 1 ? plan.days.slice(0, -1) : [];
  return days.map((day, i) => ({
    n: i + 1,
    day,
    item: day.items.find((it) => it.kind === "lodging" && it.place) ?? null,
  }));
}

function bookingOf(item: PlanItem | null): BookingState {
  return item?.lodging?.booking ?? { status: "todo", price: null, url: null, bookedAt: null };
}

function isDone(night: Night) {
  const s = bookingOf(night.item).status;
  return s === "booked" || s === "skipped";
}

/**
 * Night-by-night booking list. Booking sites can't send people back to us, so when the
 * user returns to this tab after opening one, we ask whether that night got booked and
 * then move on to the next night.
 */
export function BookingChecklist({
  draft,
  plan,
  onChange,
}: {
  draft: PlannerDraft;
  plan: TripPlan;
  onChange: (plan: TripPlan) => void;
}) {
  const nights = nightsOf(plan);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [nextUp, setNextUp] = useState<number | null>(null);

  // Ask when the user comes back from the booking site.
  useEffect(() => {
    if (!awaiting) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") setPrompt(awaiting);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [awaiting]);

  if (nights.length === 0) {
    return <p className="text-sm text-subtle">ทริปไปเช้าเย็นกลับ ไม่ต้องจองที่พัก</p>;
  }

  const done = nights.filter(isDone).length;
  const setBooking = (night: Night, patch: Partial<BookingState>, extra?: Partial<PlanItem>) => {
    const item = night.item!;
    onChange(
      updateDay(plan, night.day.index, (d) =>
        replaceItem(d, {
          ...item,
          ...extra,
          lodging: {
            ...item.lodging!,
            ...extra?.lodging,
            booking: { ...bookingOf(item), ...patch },
          },
        }),
      ),
    );
  };

  const linkFor = (night: Night, platform: BookingPlatform) => {
    const item = night.item!;
    return bookingLinks({
      name: item.place!.name,
      area: item.place!.area,
      checkIn: night.day.date,
      checkOut: nextDate(night.day.date),
      adults: draft.travelers.adults + draft.travelers.seniors,
      children: draft.travelers.children,
      lodging: item.lodging ?? { minPrice: null, maxPrice: null, filters: [], website: null },
      phone: item.phone,
    })[platform];
  };

  const openBooking = (night: Night) => {
    const platform = night.item?.lodging?.platform ?? "agoda";
    const url = linkFor(night, platform);
    window.open(url, "_blank", "noopener,noreferrer");
    setBooking(night, { status: "opened", url });
    setAwaiting(night.item!.id);
    setNextUp(null);
  };

  const promptNight = nights.find((n) => n.item?.id === prompt) ?? null;
  const finishPrompt = (status: BookingState["status"] | null) => {
    if (promptNight && status) {
      const lodging = promptNight.item?.lodging;
      const listed = lodging?.platform ? (lodging.prices[lodging.platform] ?? null) : null;
      const paid = price === "" ? listed : Math.max(0, Number(price));
      setBooking(promptNight, {
        status,
        price: status === "booked" ? paid : null,
        bookedAt: status === "booked" ? new Date().toISOString() : null,
      });
      if (status === "booked" || status === "skipped") {
        const next = nights.find((n) => n.n > promptNight.n && !isDone(n));
        setNextUp(next?.n ?? null);
        if (next) {
          requestAnimationFrame(() =>
            document
              .getElementById(`night-${next.n}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          );
        }
      }
      setAwaiting(null);
    }
    setPrompt(null);
    setPrice("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-card border-2 border-foreground bg-surface p-4 shadow-hard">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold">
            จองแล้ว {nights.filter((n) => bookingOf(n.item).status === "booked").length}/
            {nights.length} คืน
          </p>
          <p className="text-xs text-subtle">
            {done === nights.length ? "ครบทุกคืนแล้ว" : `ค้างอีก ${nights.length - done} คืน`}
          </p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full border-[1.5px] border-foreground bg-surface-2">
          <div
            className="h-full bg-secondary transition-[width]"
            style={{ width: `${(done / nights.length) * 100}%` }}
          />
        </div>
        {nextUp && (
          <p className="mt-2 text-sm font-semibold text-secondary" aria-live="polite">
            บันทึกแล้ว ต่อไป: คืนที่ {nextUp} ทำต่อได้เลยไม่ต้องเริ่มใหม่
          </p>
        )}
      </div>

      <ol className="space-y-3">
        {nights.map((night) => {
          const b = bookingOf(night.item);
          const lodging = night.item?.lodging;
          return (
            <li
              key={night.n}
              id={`night-${night.n}`}
              className={cn(
                "scroll-mt-24 rounded-card border-2 border-foreground bg-surface p-4",
                nextUp === night.n && "ring-4 ring-accent/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {isDone(night) ? (
                  <CheckCircle2 className="size-5 text-secondary" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-5 text-subtle" aria-hidden="true" />
                )}
                <p className="font-bold">คืนที่ {night.n}</p>
                <p className="text-xs text-subtle">
                  {formatThaiDate(night.day.date)} – {formatThaiDate(nextDate(night.day.date))}
                </p>
                <Badge
                  tone={
                    b.status === "booked" ? "secondary" : b.status === "opened" ? "info" : "neutral"
                  }
                  className="ml-auto"
                >
                  {BOOKING_STATUS_LABEL[b.status]}
                </Badge>
              </div>

              {!night.item ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-danger">ยังไม่ได้เลือกที่พักคืนนี้</p>
                  <Button
                    variant="mini"
                    onClick={() =>
                      document
                        .getElementById(`day-${night.day.index}`)
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    ไปเลือกที่พักในวันที่ {night.day.index + 1}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 space-y-2.5">
                  <p className="text-sm">
                    <span className="font-semibold">{night.item.place!.name}</span>
                    {night.item.place!.area && (
                      <span className="text-xs text-subtle"> · {night.item.place!.area}</span>
                    )}
                  </p>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={`ช่องทางจองคืนที่ ${night.n}`}
                  >
                    {PLATFORMS.map((p) => (
                      <Chip
                        key={p}
                        pressed={lodging?.platform === p}
                        tone="accent"
                        className="min-h-9 px-3 text-xs"
                        disabled={isDone(night)}
                        onClick={() =>
                          setBooking(
                            night,
                            {},
                            {
                              costEstimate: lodging?.prices[p] ?? night.item!.costEstimate,
                              lodging: { ...lodging!, platform: p },
                            },
                          )
                        }
                      >
                        {PLATFORM_LABEL[p]}
                        {lodging?.prices[p] != null && (
                          <span className="font-mono">
                            {lodging.prices[p]!.toLocaleString("th-TH")}
                          </span>
                        )}
                      </Chip>
                    ))}
                  </div>
                  {b.status === "booked" ? (
                    <p className="text-sm text-secondary">
                      จองผ่าน {lodging?.platform ? PLATFORM_LABEL[lodging.platform] : "—"}
                      {b.price != null ? ` · ${baht(b.price)}` : ""}
                      <button
                        type="button"
                        className="ml-3 min-h-9 text-xs font-semibold text-info underline"
                        onClick={() => setBooking(night, { status: "todo", bookedAt: null })}
                      >
                        แก้สถานะ
                      </button>
                    </p>
                  ) : b.status === "skipped" ? (
                    <button
                      type="button"
                      className="min-h-9 text-xs font-semibold text-info underline"
                      onClick={() => setBooking(night, { status: "todo" })}
                    >
                      กลับมาจองคืนนี้
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openBooking(night)}>
                        <ExternalLink className="size-4" aria-hidden="true" />
                        จองผ่าน {PLATFORM_LABEL[lodging?.platform ?? "agoda"]}
                      </Button>
                      {b.status === "opened" && (
                        <Button variant="ghost" onClick={() => setPrompt(night.item!.id)}>
                          จองเสร็จแล้ว
                        </Button>
                      )}
                      <Button
                        variant="mini"
                        onClick={() => setBooking(night, { status: "skipped" })}
                      >
                        <SkipForward className="size-3.5" aria-hidden="true" /> ไม่ต้องจอง
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {promptNight && (
        <Modal
          open
          onClose={() => finishPrompt(null)}
          title={`จองคืนที่ ${promptNight.n} เสร็จแล้วไหม?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => finishPrompt(null)}>
                ยังไม่เสร็จ
              </Button>
              <Button onClick={() => finishPrompt("booked")}>จองเสร็จแล้ว</Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm">
              {promptNight.item!.place!.name} · {formatThaiDate(promptNight.day.date)} ผ่าน{" "}
              {PLATFORM_LABEL[promptNight.item!.lodging?.platform ?? "agoda"]}
            </p>
            <Field label="ราคาที่จองจริง (บาท)" hint="ใช้คำนวณสรุปค่าใช้จ่าย เว้นว่างได้">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputClass}
                value={price}
                placeholder={String(
                  promptNight.item!.lodging?.prices[
                    promptNight.item!.lodging.platform ?? "agoda"
                  ] ?? "",
                )}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <p className="text-xs text-subtle">
              กดจองเสร็จแล้ว ระบบจะบันทึกและพาไปคืนถัดไปที่ยังไม่ได้จองต่อทันที
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
