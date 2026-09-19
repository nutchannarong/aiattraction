"use client";

import { AlertTriangle, BedDouble, Car, Coffee, MapPin, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { DayPlan, PlanItem } from "@/lib/planner/plan-types";

const KIND_ICON = {
  drive: Car,
  attraction: MapPin,
  poi: MapPin,
  lodging: BedDouble,
  meal: Utensils,
  rest_stop: Coffee,
  custom: MapPin,
} as const;

export function formatThaiDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
}

export function baht(n: number) {
  return `${Math.round(n).toLocaleString("th-TH")} บาท`;
}

export function ItemRow({ item }: { item: PlanItem }) {
  const Icon = KIND_ICON[item.kind];
  const isDrive = item.kind === "drive";
  return (
    <li
      className={cn(
        "grid grid-cols-[76px_minmax(0,1fr)] gap-3 border-b-[1.5px] border-dashed border-border py-2.5 last:border-b-0 sm:grid-cols-[92px_minmax(0,1fr)_auto]",
        isDrive && "text-muted",
      )}
    >
      <p className="font-mono text-xs font-semibold tabular-nums text-secondary">
        {item.start ?? "--:--"}
        {item.end ? `–${item.end}` : ""}
      </p>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm">
          <Icon className="size-3.5 flex-none" aria-hidden="true" />
          <span className={cn(!isDrive && "font-semibold")}>
            {item.place?.name ?? item.activity}
          </span>
          {item.place?.isSecondaryCity && <Badge tone="brand">เมืองรอง</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-subtle">
          {[
            item.place ? item.activity : null,
            item.place?.area,
            item.driveKm ? `${item.driveKm} กม.` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {item.openingHours && <p className="text-xs text-subtle">เวลาเปิด: {item.openingHours}</p>}
        {item.phone && <p className="text-xs text-subtle">โทร {item.phone}</p>}
        {item.notes && <p className="text-xs text-subtle">{item.notes}</p>}
        {item.warning && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {item.warning}
          </p>
        )}
      </div>
      {item.costEstimate != null && item.costEstimate > 0 && (
        <p className="col-start-2 font-mono text-xs font-semibold text-accent sm:col-start-auto sm:text-right">
          {baht(item.costEstimate)}
        </p>
      )}
    </li>
  );
}

export function DayCostTotal({ day }: { day: DayPlan }) {
  const total = day.items.reduce((n, i) => n + (i.costEstimate ?? 0), 0);
  return <span className="ml-auto font-mono text-sm font-semibold text-accent">{baht(total)}</span>;
}

/** Read-only day cards. */
export function DayPlanList({ days }: { days: DayPlan[] }) {
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section
          key={day.index}
          className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard"
        >
          <header className="flex flex-wrap items-center gap-2.5 border-b-2 border-foreground bg-surface-2 px-4 py-3">
            <span className="rounded-full border-2 border-foreground bg-accent px-3 py-0.5 font-display text-sm font-bold text-white dark:text-black">
              วันที่ {day.index + 1}
            </span>
            <span className="text-sm font-semibold">{day.title}</span>
            <span className="text-xs text-subtle">{formatThaiDate(day.date)}</span>
            <DayCostTotal day={day} />
          </header>
          <ul className="px-4 py-1">
            {day.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
