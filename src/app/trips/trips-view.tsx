"use client";

import { Loader2, Navigation, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";
import { deleteLocalTrip, type LocalTrip, readLocalTrips, setActiveLocalTrip } from "@/lib/local-trips";
import { vehicleTypeInfo } from "@/lib/planner/vehicles";
import type { TripSummary } from "@/lib/trip-data";
import { deleteTrip } from "./actions";

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function TripStatus({ days }: { days: number }) {
  if (days > 0)
    return <span className="rounded-full bg-secondary-soft px-2.5 py-0.5 text-xs font-bold text-secondary">อีก {days.toLocaleString("th-TH")} วัน</span>;
  if (days === 0)
    return <span className="rounded-full border border-foreground bg-brand px-2.5 py-0.5 text-xs font-bold text-white dark:text-black">วันนี้</span>;
  return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger">ผ่านไปแล้ว</span>;
}

function localSummary(trip: LocalTrip): TripSummary {
  const first = trip.plan.days[0];
  const last = trip.plan.days[trip.plan.days.length - 1];
  return {
    id: trip.id,
    source: "local",
    title: `${trip.draft.origin?.label ?? "ต้นทาง"} → ${trip.draft.destination?.label ?? "ปลายทาง"}`,
    originLabel: trip.draft.origin?.label ?? "ต้นทาง",
    destinationLabel: trip.draft.destination?.label ?? "ปลายทาง",
    startDate: first.date,
    endDate: last.date,
    dayCount: trip.plan.days.length,
    stopCount: trip.plan.days.reduce((count, day) => count + day.items.filter((item) => item.kind !== "drive" && item.place).length, 0),
    distanceKm: trip.plan.totals.distanceKm,
    fuelCost: trip.plan.totals.fuelCost,
    vehicleLabel: vehicleTypeInfo(trip.draft.vehicle.type).label,
    status: "upcoming",
  };
}

export function TripsView({ initialTrips }: { initialTrips: TripSummary[] }) {
  const router = useRouter();
  const [localTrips, setLocalTrips] = useState<LocalTrip[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleting, startDeleting] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocalTrips(readLocalTrips());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const trips = useMemo(() => {
    const byId = new Map<string, TripSummary>();
    for (const trip of localTrips) byId.set(trip.id, localSummary(trip));
    for (const trip of initialTrips) byId.set(trip.id, trip);
    return [...byId.values()].filter((trip) => !hidden.includes(trip.id)).toSorted((a, b) => a.startDate.localeCompare(b.startDate));
  }, [hidden, initialTrips, localTrips]);

  if (!loaded) return <div className="h-48 animate-pulse rounded-card border-2 border-foreground bg-surface" />;
  if (!trips.length)
    return (
      <StickerCard className="px-5 py-14 text-center text-subtle">
        <h2 className="text-lg font-bold">ยังไม่มีแผนที่บันทึกไว้</h2>
        <p className="mt-2 text-sm">ไปที่หน้า “วางแผน” แล้วกดปุ่ม “สร้างแผนของฉัน” ที่ท้ายหน้า</p>
      </StickerCard>
    );

  return (
    <div className="space-y-3">
      {trips.map((trip) => (
        <article key={trip.id} className="grid items-center gap-3 rounded-[13px] border-2 border-foreground bg-surface p-4 shadow-hard sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">{trip.originLabel} → {trip.destinationLabel}</h2>
              <TripStatus days={daysUntil(trip.startDate)} />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-subtle sm:text-sm">
              {thaiDate(trip.startDate)} – {thaiDate(trip.endDate)} · {trip.dayCount} วัน · {trip.stopCount} จุด · {trip.vehicleLabel} · {Math.round(trip.distanceKm).toLocaleString("th-TH")} กม. · ค่าน้ำมัน {Math.round(trip.fuelCost).toLocaleString("th-TH")} ฿
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              if (trip.source === "local") {
                setActiveLocalTrip(trip.id);
                router.push("/live");
              } else router.push(`/live?trip=${trip.id}`);
            }}>
              <Navigation className="size-4" aria-hidden="true" /> เริ่มแผน
            </Button>
            <Button variant="ghost" disabled={deleting} onClick={() => {
              if (!window.confirm(`ลบแผน ${trip.originLabel} → ${trip.destinationLabel}?`)) return;
              startDeleting(async () => {
                if (trip.source === "supabase") {
                  const result = await deleteTrip(trip.id);
                  if ("error" in result) return void window.alert(result.error);
                }
                deleteLocalTrip(trip.id);
                setLocalTrips((current) => current.filter((item) => item.id !== trip.id));
                setHidden((current) => [...current, trip.id]);
                router.refresh();
              });
            }}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />} ลบ
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
