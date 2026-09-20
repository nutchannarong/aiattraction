"use client";

import { Loader2, Navigation, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";
import {
  clearAllLocalTrips,
  deleteLocalTrip,
  type LocalTrip,
  readLocalTrips,
  setActiveLocalTrip,
} from "@/lib/local-trips";
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
  const stopCount = trip.plan.days.reduce((count, day) => count + day.items.filter((item) => item.kind !== "drive" && item.place).length, 0);
  const progress = typeof window === "undefined" ? 0 : Number(localStorage.getItem(`thainhaidee:live-progress:${trip.id}`));
  return {
    id: trip.id,
    source: "local",
    title: `${trip.draft.origin?.label ?? "ต้นทาง"} → ${trip.draft.destination?.label ?? "ปลายทาง"}`,
    originLabel: trip.draft.origin?.label ?? "ต้นทาง",
    destinationLabel: trip.draft.destination?.label ?? "ปลายทาง",
    startDate: first.date,
    endDate: last.date,
    dayCount: trip.plan.days.length,
    stopCount,
    distanceKm: trip.plan.totals.distanceKm,
    fuelCost: trip.plan.totals.fuelCost,
    vehicleLabel: vehicleTypeInfo(trip.draft.vehicle.type).label,
    status: stopCount > 0 && Number.isInteger(progress) && progress >= stopCount ? "done" : trip.status ?? "upcoming",
  };
}

export function TripsView({
  initialTrips,
  isAuthenticated = true,
}: {
  initialTrips: TripSummary[];
  isAuthenticated?: boolean;
}) {
  const router = useRouter();
  const [localTrips, setLocalTrips] = useState<LocalTrip[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleting, startDeleting] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isAuthenticated) {
        clearAllLocalTrips();
        setLocalTrips([]);
      } else {
        setLocalTrips(readLocalTrips());
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  const trips = useMemo(() => {
    if (!isAuthenticated) return [];
    const byId = new Map<string, TripSummary>();
    for (const trip of localTrips) byId.set(trip.id, localSummary(trip));
    for (const trip of initialTrips) byId.set(trip.id, trip);
    return [...byId.values()]
      .filter((trip) => !hidden.includes(trip.id))
      .toSorted((a, b) => a.startDate.localeCompare(b.startDate));
  }, [hidden, initialTrips, localTrips, isAuthenticated]);
  const upcomingTrips = trips.filter((trip) => trip.status !== "done" && daysUntil(trip.endDate) >= 0);
  const completedTrips = trips.filter((trip) => trip.status === "done" || daysUntil(trip.endDate) < 0);

  const tripCard = (trip: TripSummary, completed = false) => (
    <article
      key={trip.id}
      className={`grid items-center gap-3 rounded-[13px] border-2 p-4 sm:grid-cols-[1fr_auto] ${
        completed ? "border-border bg-surface-2 text-subtle opacity-65 grayscale" : "border-foreground bg-surface shadow-hard"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">{trip.originLabel} → {trip.destinationLabel}</h2>
          {completed ? (
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-bold">เดินทางแล้ว</span>
          ) : (
            <TripStatus days={daysUntil(trip.startDate)} />
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-subtle sm:text-sm">
          {thaiDate(trip.startDate)} – {thaiDate(trip.endDate)} · {trip.dayCount} วัน · {trip.stopCount} จุด · {trip.vehicleLabel} · {Math.round(trip.distanceKm).toLocaleString("th-TH")} กม. · ค่าน้ำมัน {Math.round(trip.fuelCost).toLocaleString("th-TH")} ฿
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!completed && <Button onClick={() => {
          if (trip.source === "local") {
            setActiveLocalTrip(trip.id);
            router.push("/live");
          } else router.push(`/live?trip=${trip.id}`);
        }}>
          <Navigation className="size-4" aria-hidden="true" /> เริ่มแผน
        </Button>}
        <Button variant="ghost" disabled={deleting} onClick={() => {
          if (!window.confirm(`ลบแผน ${trip.originLabel} → ${trip.destinationLabel}?`)) return;
          startDeleting(async () => {
            let serverError: string | null = null;
            if (trip.source === "supabase") {
              try {
                const result = await deleteTrip(trip.id);
                if ("error" in result) {
                  serverError = result.error;
                }
              } catch (err) {
                console.error("Delete trip failed:", err);
                serverError = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง";
              }
            }
            // Always clean up locally so cached or ghost trips are never stuck
            deleteLocalTrip(trip.id);
            setLocalTrips((current) => current.filter((item) => item.id !== trip.id));
            setHidden((current) => [...current, trip.id]);

            if (serverError) {
              window.alert(serverError);
            } else {
              router.refresh();
            }
          });
        }}>
          {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />} ลบ
        </Button>
      </div>
    </article>
  );

  if (!loaded) return <div className="h-48 animate-pulse rounded-card border-2 border-foreground bg-surface" />;

  if (!isAuthenticated) {
    return (
      <StickerCard className="px-5 py-14 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-foreground bg-secondary-soft text-secondary shadow-hard-sm">
          <Navigation className="size-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold">เข้าสู่ระบบเพื่อดูแผนของคุณ</h2>
        <p className="mx-auto mt-2 max-w-[44ch] text-sm text-subtle">
          แผนการเดินทางที่บันทึกไว้จะผูกกับบัญชีของคุณ เพื่อให้คุณเปิดดูและนำทางได้จากทุกอุปกรณ์
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/login?next=/trips" className={buttonClass("cta")}>
            เข้าสู่ระบบ / สมัครสมาชิก
          </Link>
        </div>
      </StickerCard>
    );
  }

  if (!trips.length)
    return (
      <StickerCard className="px-5 py-14 text-center text-subtle">
        <h2 className="text-lg font-bold">ยังไม่มีแผนที่บันทึกไว้</h2>
        <p className="mt-2 text-sm">ไปที่หน้า “วางแผน” แล้วกดปุ่ม “สร้างแผนของฉัน” ที่ท้ายหน้า</p>
      </StickerCard>
    );

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h2 className="text-lg font-bold">ทริปที่กำลังจะถึง</h2>
        {upcomingTrips.length ? upcomingTrips.map((trip) => tripCard(trip)) : <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-subtle">ยังไม่มีทริปที่กำลังจะถึง</p>}
      </section>
      {completedTrips.length > 0 && (
        <section className="space-y-3 border-t border-dashed border-border pt-5">
          <h2 className="text-sm font-bold text-subtle">เดินทางครบแล้ว</h2>
          {completedTrips.map((trip) => tripCard(trip, true))}
        </section>
      )}
    </div>
  );
}
