"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Selecting = "start" | "end";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function thaiDate(value: string) {
  return parseIso(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function weekday(value: string) {
  return parseIso(value).toLocaleDateString("th-TH", { weekday: "long" });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function Month({
  month,
  today,
  start,
  end,
  onPick,
  className,
}: {
  month: Date;
  today: string;
  start: string;
  end: string;
  onPick: (date: string) => void;
  className?: string;
}) {
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const blanks = month.getDay();
  const cells = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: count }, (_, index) =>
      toIso(new Date(month.getFullYear(), month.getMonth(), index + 1, 12)),
    ),
  ];

  return (
    <section className={className} aria-label={monthLabel(month)}>
      <h4 className="mb-3 text-center font-display text-sm font-bold">{monthLabel(month)}</h4>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-subtle">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} aria-hidden="true" />;
          const disabled = date < today;
          const isStart = date === start;
          const isEnd = date === end;
          const inRange = date > start && date < end;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-label={parseIso(date).toLocaleDateString("th-TH", { dateStyle: "full" })}
              aria-pressed={isStart || isEnd}
              onClick={() => onPick(date)}
              className={cn(
                "min-h-9 rounded-lg text-xs font-semibold transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-25",
                inRange && "rounded-none bg-accent-soft hover:bg-accent-soft",
                isStart && "bg-accent text-white hover:bg-accent dark:text-black",
                isEnd && "bg-secondary text-white hover:bg-secondary dark:text-black",
              )}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DateRangeCalendar({
  start,
  end,
  today,
  onChange,
  endLabel = "เดินทางกลับ",
}: {
  start: string;
  end: string;
  today: string;
  /** Name for the end date, e.g. "วันสุดท้ายของทริป" on one-way trips. */
  endLabel?: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
}) {
  const [selecting, setSelecting] = useState<Selecting>("start");
  const [shownMonth, setShownMonth] = useState(() => monthStart(parseIso(start)));
  const minimumMonth = monthStart(parseIso(today));
  const days = Math.round((parseIso(end).getTime() - parseIso(start).getTime()) / 86_400_000) + 1;

  const pick = (date: string) => {
    if (selecting === "start") {
      onChange({ startDate: date, endDate: end < date ? date : end });
      setSelecting("end");
      return;
    }
    if (date < start) {
      onChange({ startDate: date, endDate: date });
      setSelecting("end");
      return;
    }
    onChange({ startDate: start, endDate: date });
    setSelecting("start");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={selecting === "start"}
          onClick={() => {
            setSelecting("start");
            setShownMonth(monthStart(parseIso(start)));
          }}
          className={cn(
            "rounded-xl border-2 bg-surface p-3 text-left transition",
            selecting === "start" ? "border-accent shadow-hard-sm" : "border-border",
          )}
        >
          <span className="block text-[11px] font-bold text-subtle">ออกเดินทาง</span>
          <strong className="mt-1 block font-display text-sm">{thaiDate(start)}</strong>
          <span className="mt-1 block text-xs text-subtle">{weekday(start)}</span>
        </button>
        <button
          type="button"
          aria-pressed={selecting === "end"}
          onClick={() => {
            setSelecting("end");
            setShownMonth(monthStart(parseIso(end)));
          }}
          className={cn(
            "rounded-xl border-2 bg-surface p-3 text-left transition",
            selecting === "end" ? "border-secondary shadow-hard-sm" : "border-border",
          )}
        >
          <span className="block text-[11px] font-bold text-subtle">{endLabel}</span>
          <strong className="mt-1 block font-display text-sm">{thaiDate(end)}</strong>
          <span className="mt-1 block text-xs text-subtle">{weekday(end)}</span>
        </button>
      </div>

      <div className="rounded-[13px] border-2 border-foreground bg-surface p-3 shadow-hard-sm sm:p-4">
        <div className="mb-3 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <button
            type="button"
            aria-label="เดือนก่อนหน้า"
            disabled={shownMonth <= minimumMonth}
            onClick={() => setShownMonth((month) => addMonths(month, -1))}
            className="grid size-9 place-items-center rounded-full border-2 border-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <p className="text-center font-display text-sm font-bold">
            {selecting === "start"
              ? "เลือกวันออกเดินทาง"
              : `เลือกวัน${endLabel.replace(/^วัน/, "")}`}
          </p>
          <button
            type="button"
            aria-label="เดือนถัดไป"
            onClick={() => setShownMonth((month) => addMonths(month, 1))}
            className="grid size-9 place-items-center rounded-full border-2 border-foreground"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Month month={shownMonth} today={today} start={start} end={end} onPick={pick} />
          <Month
            month={addMonths(shownMonth, 1)}
            today={today}
            start={start}
            end={end}
            onPick={pick}
            className="hidden sm:block"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-[1.5px] border-dashed border-border pt-3 text-xs text-subtle">
          <span>
            {thaiDate(start)} → {thaiDate(end)}
          </span>
          <strong className="font-mono text-foreground">
            {days} วัน {Math.max(0, days - 1)} คืน
          </strong>
        </div>
      </div>
    </div>
  );
}
