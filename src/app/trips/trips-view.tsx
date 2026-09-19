"use client";

import { Navigation, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";
import {
  deleteLocalTrip,
  type LocalTrip,
  readLocalTrips,
  setActiveLocalTrip,
} from "@/lib/local-trips";
import { costTotals } from "@/lib/planner/edit";
import { vehicleTypeInfo } from "@/lib/planner/vehicles";

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function TripStatus({ days }: { days: number }) {
  if (days > 0)
    return (
      <span className="rounded-full bg-secondary-soft px-2.5 py-0.5 text-xs font-bold text-secondary">
        อีก {days.toLocaleString("th-TH")} วัน
      </span>
    );
  if (days === 0)
    return (
      <span className="rounded-full border border-foreground bg-brand px-2.5 py-0.5 text-xs font-bold text-white dark:text-black">
        วันนี้
      </span>
    );
  return (
    <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger">
      ผ่านไปแล้ว
    </span>
  );
}

export function TripsView() {
  const router = useRouter();
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTrips(
        readLocalTrips().toSorted((a, b) =>
          a.plan.days[0].date.localeCompare(b.plan.days[0].date),
        ),
      );
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!loaded)
    return <div className="h-48 animate-pulse rounded-card border-2 border-foreground bg-surface" />;

  if (!trips.length) {
    return (
      <StickerCard className="px-5 py-14 text-center text-subtle">
        <h2 className="text-lg font-bold">ยังไม่มีแผนที่บันทึกไว้</h2>
        <p className="mt-2 text-sm">
          ไปที่หน้า “วางแผน” แล้วกดปุ่ม “สร้างแผนของฉัน” ที่ท้ายหน้า
        </p>
      </StickerCard>
    );
  }

  return (
    <div className="space-y-3">
      {trips.map((trip) => {
        const first = trip.plan.days[0];
        const last = trip.plan.days[trip.plan.days.length - 1];
        const dayCount = trip.plan.days.length;
        const nights = Math.max(0, dayCount - 1);
        const stops = trip.plan.days.reduce(
          (count, day) =>
            count + day.items.filter((item) => item.kind === "attraction").length,
          0,
        );
        const total = Math.round(costTotals(trip.plan).total);
        const vehicle = vehicleTypeInfo(trip.draft.vehicle.type).label;
        const from = trip.draft.origin?.label ?? "ต้นทาง";
        const to = trip.draft.destination?.label ?? "ปลายทาง";

        return (
          <article
            key={trip.id}
            className="grid items-center gap-3 rounded-[13px] border-2 border-foreground bg-surface p-4 shadow-hard sm:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">
                  {from} → {to}
                </h2>
                <TripStatus days={daysUntil(first.date)} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-subtle sm:text-sm">
                {thaiDate(first.date)} – {thaiDate(last.date)} · {dayCount} วัน {nights} คืน · {stops} จุด · {vehicle} · รวม {total.toLocaleString("th-TH")} ฿
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setActiveLocalTrip(trip.id);
                  router.push("/live");
                }}
              >
                <Navigation className="size-4" aria-hidden="true" /> เริ่มแผน
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!window.confirm(`ลบแผน ${from} → ${to}?`)) return;
                  deleteLocalTrip(trip.id);
                  setTrips((current) => current.filter((item) => item.id !== trip.id));
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" /> ลบ
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
