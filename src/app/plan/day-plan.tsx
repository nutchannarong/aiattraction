"use client";

import { AlertTriangle, BedDouble, Car, Coffee, MapPin, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { lookupLinks } from "@/lib/planner/poi-categories";
import {
  BOOKING_STATUS_LABEL,
  PLATFORM_LABEL,
  type DayPlan,
  type PlanItem,
} from "@/lib/planner/plan-types";

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

export function ItemRow({ item, actions }: { item: PlanItem; actions?: ReactNode }) {
  const Icon = KIND_ICON[item.kind];
  const isDrive = item.kind === "drive";
  const booking = item.lodging?.booking;
  return (
    <li
      className={cn(
        "grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b-[1.5px] border-dashed border-border py-2.5 last:border-b-0 sm:grid-cols-[92px_minmax(0,1fr)_auto]",
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
        {item.parking && <p className="text-xs text-subtle">ที่จอดรถ: {item.parking}</p>}
        {item.notes && <p className="text-xs text-subtle">{item.notes}</p>}
        {item.lodging && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            {item.lodging.platform && (
              <span className="text-subtle">จองผ่าน {PLATFORM_LABEL[item.lodging.platform]}</span>
            )}
            {booking && (
              <Badge tone={booking.status === "booked" ? "secondary" : "neutral"}>
                {BOOKING_STATUS_LABEL[booking.status]}
              </Badge>
            )}
          </p>
        )}
        {item.place && !isDrive && item.place.source !== "pin" && (
          <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs">
            {lookupLinks(item.place.name, item.place.area, item.place.category).map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                {l.label}
              </a>
            ))}
          </p>
        )}
        {item.warning && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {item.warning}
          </p>
        )}
      </div>
      <div className="col-start-2 flex flex-col gap-1.5 sm:col-start-auto sm:items-end">
        {item.costEstimate != null && item.costEstimate > 0 && (
          <p className="font-mono text-xs font-semibold text-accent sm:text-right">
            {baht(item.costEstimate)}
          </p>
        )}
        {actions}
      </div>
    </li>
  );
}

export function DayCostTotal({ day }: { day: DayPlan }) {
  const total = day.items.reduce((n, i) => n + (i.costEstimate ?? 0), 0);
  return <span className="ml-auto font-mono text-sm font-semibold text-accent">{baht(total)}</span>;
}
