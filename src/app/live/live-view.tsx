"use client";

import { CheckCircle2, ChevronDown, LocateFixed, MapPin, Navigation, RefreshCw, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { NearbyPicker } from "@/app/plan/nearby-picker";
import { replaceTripItemPlace, setTripItemProgress } from "@/app/trips/actions";
import { buttonClass, Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Modal } from "@/components/ui/modal";
import { StickerCard } from "@/components/ui/sticker-card";
import { Toggle } from "@/components/ui/toggle";
import { distanceMeters, formatDistance, type Coordinates } from "@/lib/geo";
import { type LocalTrip, readActiveLocalTrip, saveLocalTrip } from "@/lib/local-trips";
import { NEARBY_CATEGORIES, type NearbyPlace } from "@/lib/planner/nearby";
import { replaceLiveItem } from "@/lib/planner/replan";
import type { LiveTrip, LiveTripItem, TripProgressStatus } from "@/lib/trip-data";

type PositionState = { coords: Coordinates; accuracy: number; updatedAt: number };
type Stop = { item: LiveTripItem; day: LiveTrip["days"][number] };

const DailyPlanMap = dynamic(() => import("@/components/daily-plan-map"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-surface-2 motion-reduce:animate-none sm:h-72" />,
});

function thaiDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

function navigationUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

function fromLocal(trip: LocalTrip): LiveTrip {
  return {
    id: trip.id,
    source: "local",
    title: `${trip.draft.origin?.label ?? "ต้นทาง"} → ${trip.draft.destination?.label ?? "ปลายทาง"}`,
    originLabel: trip.draft.origin?.label ?? "ต้นทาง",
    destinationLabel: trip.draft.destination?.label ?? "ปลายทาง",
    status: trip.status ?? "upcoming",
    days: trip.plan.days.map((day) => ({
      id: `local-day-${day.index}`,
      index: day.index,
      date: day.date,
      finished: day.finished,
      items: day.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        start: item.start,
        end: item.end,
        activity: item.activity,
        place: item.place,
        costEstimate: item.costEstimate,
        costCategory: item.costCategory,
        phone: item.phone,
        openingHours: item.openingHours,
        notes: item.notes,
        warning: item.warning,
        parking: item.parking ?? null,
        progressStatus: "pending",
      })),
    })),
  };
}

function replanCategory(item: LiveTripItem) {
  if (item.place?.source === "attraction") return "same";
  if (item.kind === "lodging") return "lodging";
  if (item.kind === "meal") return item.place?.category === "cafe" ? "cafe" : "restaurant";
  return NEARBY_CATEGORIES.find((category) => category.kinds?.includes(item.place?.category ?? ""))?.key ?? "attraction";
}

function firstPendingStop(trip: LiveTrip | null) {
  if (!trip) return 0;
  const items = trip.days.flatMap((day) =>
    day.items.filter((item) => item.place && item.kind !== "drive"),
  );
  const pending = items.findIndex((item) => item.progressStatus === "pending");
  return pending < 0 ? items.length : pending;
}

export function LiveView({ initialTrip }: { initialTrip: LiveTrip | null }) {
  const [trip, setTrip] = useState<LiveTrip | null>(initialTrip);
  const [localTrip, setLocalTrip] = useState<LocalTrip | null>(null);
  const [loaded, setLoaded] = useState(Boolean(initialTrip));
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [stopIndex, setStopIndex] = useState(() => firstPendingStop(initialTrip));
  const [replanning, setReplanning] = useState<Stop | null>(null);
  const [expandedCompletedDays, setExpandedCompletedDays] = useState<Set<string>>(() => new Set());
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (initialTrip) return;
    const timer = window.setTimeout(() => {
      const active = readActiveLocalTrip();
      setLocalTrip(active);
      setTrip(active ? fromLocal(active) : null);
      if (active) {
        const saved = Number(localStorage.getItem(`thainhaidee:live-progress:${active.id}`));
        setStopIndex(Number.isInteger(saved) && saved >= 0 ? saved : 0);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialTrip]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  const stops = useMemo<Stop[]>(() => trip ? trip.days.flatMap((day) => day.items.filter((item) => item.place && item.kind !== "drive").map((item) => ({ item, day }))) : [], [trip]);
  const currentStop = stops[stopIndex] ?? null;
  const stopOrder = useMemo(() => new Map(stops.map((stop, index) => [stop.item.id, index])), [stops]);
  const currentDistance = position && currentStop?.item.place ? distanceMeters(position.coords, currentStop.item.place) : null;

  const setTrackingEnabled = (enabled: boolean) => {
    if (!enabled) {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
      return;
    }
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setGeoError("เบราว์เซอร์นี้ไม่พร้อมใช้งานตำแหน่ง กรุณาเปิดผ่าน HTTPS หรือ localhost");
      return;
    }
    setGeoError(null);
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (result) => setPosition({ coords: { latitude: result.coords.latitude, longitude: result.coords.longitude }, accuracy: Math.round(result.coords.accuracy), updatedAt: result.timestamp }),
      (error) => {
        setTracking(false);
        watchId.current = null;
        setGeoError(error.code === error.PERMISSION_DENIED ? "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาต Location ในการตั้งค่าเว็บไซต์" : "ระบุตำแหน่งไม่สำเร็จ กรุณาตรวจว่าเปิดบริการตำแหน่งของเครื่องแล้ว");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  };

  const updateItem = (itemId: string, change: (item: LiveTripItem) => LiveTripItem) => {
    setTrip((current) => current ? { ...current, days: current.days.map((day) => ({ ...day, items: day.items.map((item) => item.id === itemId ? change(item) : item) })) } : current);
  };

  const advance = async (status: Exclude<TripProgressStatus, "pending">) => {
    if (!trip || !currentStop || working) return;
    setWorking(true);
    setActionError(null);
    if (trip.source === "supabase") {
      const result = await setTripItemProgress(trip.id, currentStop.item.id, status);
      if ("error" in result) {
        setActionError(result.error ?? "บันทึกความคืบหน้าไม่สำเร็จ");
        setWorking(false);
        return;
      }
      updateItem(currentStop.item.id, (item) => ({ ...item, progressStatus: status }));
    } else {
      const nextIndex = Math.min(stops.length, stopIndex + 1);
      localStorage.setItem(`thainhaidee:live-progress:${trip.id}`, String(nextIndex));
      if (localTrip) {
        const updated = { ...localTrip, status: nextIndex >= stops.length ? "done" as const : "active" as const };
        saveLocalTrip(updated);
        setLocalTrip(updated);
      }
      updateItem(currentStop.item.id, (item) => ({ ...item, progressStatus: status }));
      setTrip((current) => current && nextIndex >= stops.length ? { ...current, status: "done" } : current);
    }
    setStopIndex((index) => Math.min(stops.length, index + 1));
    setWorking(false);
  };

  const resetProgress = () => {
    if (!trip || trip.source !== "local") return;
    localStorage.setItem(`thainhaidee:live-progress:${trip.id}`, "0");
    if (localTrip) {
      const updated = { ...localTrip, status: "upcoming" as const };
      saveLocalTrip(updated);
      setLocalTrip(updated);
    }
    setTrip((current) => current ? { ...current, status: "upcoming", days: current.days.map((day) => ({ ...day, items: day.items.map((item) => ({ ...item, progressStatus: "pending" as const })) })) } : current);
    setStopIndex(0);
  };

  const pickReplacement = async (nearby: NearbyPlace) => {
    if (!trip || !replanning) return;
    setWorking(true);
    setActionError(null);
    const next = replaceLiveItem(replanning.item, nearby, replanning.day.date);
    if (trip.source === "supabase") {
      const result = await replaceTripItemPlace(trip.id, replanning.item.id, {
        source: nearby.place.source,
        id: nearby.place.id ?? null,
        name: nearby.place.name,
        area: nearby.place.area ?? null,
        latitude: nearby.place.latitude,
        longitude: nearby.place.longitude,
        category: nearby.place.category ?? null,
        isSecondaryCity: nearby.place.isSecondaryCity ?? null,
        phone: nearby.phone,
        openingHours: nearby.openingHours,
        warning: next.warning,
      });
      if ("error" in result) {
        setActionError(result.error ?? "เปลี่ยนสถานที่ไม่สำเร็จ");
        setWorking(false);
        return;
      }
    } else if (localTrip) {
      const updated: LocalTrip = {
        ...localTrip,
        plan: { ...localTrip.plan, days: localTrip.plan.days.map((day) => ({ ...day, items: day.items.map((item) => item.id === next.id ? { ...item, place: next.place, phone: next.phone, openingHours: next.openingHours, warning: next.warning } : item) })) },
      };
      saveLocalTrip(updated);
      setLocalTrip(updated);
    }
    updateItem(next.id, () => next);
    setReplanning(null);
    setWorking(false);
  };

  return (
    <div className="space-y-5">
      <StickerCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="font-sans text-sm font-bold sm:text-base">ติดตามตำแหน่งแบบต่อเนื่อง (GPS)</h2><p className="mt-0.5 text-xs text-subtle sm:text-sm">ใช้ Geolocation API ของเบราว์เซอร์จริง ตำแหน่งไม่ถูกส่งออกไปไหน</p></div>
          <Toggle label="ติดตามตำแหน่งแบบต่อเนื่อง" hideLabel checked={tracking} onChange={setTrackingEnabled} />
        </div>
        {position ? <div className="mt-4 rounded-lg bg-surface-2 p-3 font-mono text-xs text-muted">พิกัดปัจจุบัน {position.coords.latitude.toFixed(5)}, {position.coords.longitude.toFixed(5)} · ความแม่นยำ ±{position.accuracy.toLocaleString("th-TH")} ม. · อัปเดต {new Date(position.updatedAt).toLocaleTimeString("th-TH")}</div> : <p className="mt-4 text-xs text-subtle">กดสวิตช์เพื่อเริ่มติดตามตำแหน่ง</p>}
        {geoError && <div className="mt-3"><Callout tone="danger">{geoError}</Callout></div>}
      </StickerCard>

      {!loaded ? <div className="h-48 animate-pulse rounded-card border-2 border-foreground bg-surface" /> : !trip ? (
        <StickerCard className="px-5 py-14 text-center text-subtle"><h2 className="text-lg font-bold">ยังไม่มีแผนที่เลือกไว้</h2><p className="mt-2 text-sm">ไปที่ “แผนของฉัน” แล้วกดเริ่มแผน</p><Link href="/trips" className={buttonClass("ghost", "mt-4")}>ไปแผนของฉัน</Link></StickerCard>
      ) : (
        <div className="space-y-4">
          <StickerCard className="p-5"><p className="text-xs font-semibold text-accent">แผนที่กำลังเดินทาง</p><h2 className="mt-1 text-xl font-bold">{trip.originLabel} → {trip.destinationLabel}</h2></StickerCard>
          {actionError && <Callout tone="danger">{actionError}</Callout>}
          {currentStop?.item.place ? (
            <section className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-active">
              <div className="border-b-2 border-foreground bg-accent-soft px-5 py-3"><p className="text-xs font-bold uppercase tracking-wider text-accent">จุดถัดไป {stopIndex + 1} / {stops.length}</p></div>
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div><p className="text-xs text-subtle">วันที่ {currentStop.day.index + 1} · {thaiDate(currentStop.day.date)} · {currentStop.item.start ?? "ไม่ระบุเวลา"}</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-bold"><MapPin className="size-5 flex-none text-accent" aria-hidden="true" />{currentStop.item.place.name}</h2><p className="mt-1 text-sm text-muted">{[currentStop.item.activity, currentStop.item.place.area].filter(Boolean).join(" · ")}</p>{currentDistance != null && <p className="mt-3 font-mono text-sm font-semibold text-info">ห่างจากคุณ {formatDistance(currentDistance)}</p>}{currentDistance != null && currentDistance <= Math.max(150, position!.accuracy * 2) && <p className="mt-2 text-sm font-semibold text-secondary">คุณอยู่ใกล้จุดหมายแล้ว — กด “ถึงแล้ว” เพื่อไปจุดต่อไป</p>}</div>
                <div className="flex flex-col gap-2">
                  <a href={navigationUrl(currentStop.item.place.latitude, currentStop.item.place.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass("ink")}><Navigation className="size-4" aria-hidden="true" /> นำทางไปจุดนี้</a>
                  <Button variant="ghost" onClick={() => setReplanning(currentStop)} disabled={working}><RefreshCw className="size-4" aria-hidden="true" /> เปลี่ยนแผน</Button>
                  <button type="button" className={buttonClass("cta")} disabled={working} onClick={() => void advance("completed")}><CheckCircle2 className="size-4" aria-hidden="true" /> ถึงแล้ว ไปจุดถัดไป</button>
                  <button type="button" disabled={working} className="min-h-9 text-xs font-semibold text-subtle underline disabled:opacity-50" onClick={() => void advance("skipped")}>ข้ามจุดนี้</button>
                </div>
              </div>
            </section>
          ) : stops.length > 0 ? (
            <StickerCard className="p-6 text-center"><CheckCircle2 className="mx-auto size-10 text-secondary" aria-hidden="true" /><h2 className="mt-2 text-xl font-bold">เดินทางครบทุกจุดแล้ว</h2><p className="mt-1 text-sm text-muted">จบทริปเรียบร้อย ขอให้เดินทางกลับโดยสวัสดิภาพ</p>{trip.source === "local" && <button type="button" className={buttonClass("ghost", "mt-4")} onClick={resetProgress}><RotateCcw className="size-4" aria-hidden="true" /> เริ่มลำดับใหม่</button>}</StickerCard>
          ) : null}

          {trip.days.map((day) => {
            const previousDay = trip.days.find((candidate) => candidate.index === day.index - 1);
            const mapStart = previousDay?.items.toReversed().find((item) => item.place)?.place ?? null;
            const completedItemIds = day.items
              .filter((item) => {
                const order = stopOrder.get(item.id);
                return item.progressStatus !== "pending" || (trip.source === "local" && order != null && order < stopIndex);
              })
              .map((item) => item.id);
            const activeItemId = day.items.find((item) => stopOrder.get(item.id) === stopIndex)?.id ?? null;
            const dayStops = day.items.filter((item) => item.place && item.kind !== "drive");
            // A planning-day `finished` flag only means the itinerary was edited.
            // Collapse only after every real stop has been completed or skipped in live mode.
            const dayComplete = dayStops.length > 0 && dayStops.every((item) => completedItemIds.includes(item.id));
            const collapsed = dayComplete && !expandedCompletedDays.has(day.id);
            return (
            <section key={day.id} className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard">
              <header className={`bg-surface-2 px-4 py-3 ${collapsed ? "" : "border-b-2 border-foreground"}`}>
                <button
                  type="button"
                  disabled={!dayComplete}
                  onClick={() => setExpandedCompletedDays((current) => {
                    const next = new Set(current);
                    if (next.has(day.id)) next.delete(day.id); else next.add(day.id);
                    return next;
                  })}
                  className={`flex w-full items-center gap-2 text-left ${dayComplete ? "cursor-pointer" : "cursor-default"}`}
                  aria-expanded={!collapsed}
                >
                  <h3 className="text-base font-bold">วันที่ {day.index + 1} · {thaiDate(day.date)}</h3>
                  {dayComplete && <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-xs font-bold text-secondary">เสร็จแล้ว</span>}
                  {dayComplete && <ChevronDown className={`ml-auto size-4 text-subtle transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden="true" />}
                </button>
              </header>
              {!collapsed && <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
                <div id={`live-day-items-${day.id}`} className="min-w-0 lg:border-r-[1.5px] lg:border-border">
                  <ol className="divide-y divide-dashed divide-border px-4">{day.items.map((item) => {
                const order = stopOrder.get(item.id);
                const isPast = item.progressStatus !== "pending" || (trip.source === "local" && order != null && order < stopIndex);
                const isCurrent = order === stopIndex;
                const distance = position && item.place ? distanceMeters(position.coords, item.place) : null;
                const isDrive = item.kind === "drive";
                return <li key={item.id} className={`grid gap-3 py-3 sm:grid-cols-[76px_1fr_auto] sm:items-center ${isPast ? "opacity-45" : ""} ${isCurrent ? "-mx-2 rounded-lg bg-accent-soft px-2" : ""}`}><span className="font-mono text-xs font-semibold text-secondary">{item.start ?? "--:--"}</span><div className="min-w-0"><p className={`flex items-center gap-1.5 text-sm ${isDrive ? "text-muted" : "font-semibold"}`}>{!isDrive && (isPast ? <CheckCircle2 className="size-3.5 flex-none text-secondary" aria-hidden="true" /> : <MapPin className="size-3.5 flex-none" aria-hidden="true" />)}{item.place?.name ?? item.activity}{isCurrent && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white dark:text-black">จุดถัดไป</span>}</p>{!isDrive && <p className="mt-0.5 text-xs text-subtle">{[item.activity, item.place?.area, distance != null ? `ห่าง ${formatDistance(distance)}` : null].filter(Boolean).join(" · ")}</p>}{item.warning && <p className="mt-1 text-xs font-semibold text-danger">{item.warning}</p>}</div>{item.place && isCurrent && <a href={navigationUrl(item.place.latitude, item.place.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass("mini")}><Navigation className="size-3.5" aria-hidden="true" /> นำทาง</a>}</li>;
                  })}</ol>
                </div>
                <aside className="flex min-w-0 flex-col border-t-[1.5px] border-border bg-surface-3 lg:border-t-0">
                  <DailyPlanMap
                    day={day}
                    start={mapStart}
                    className="h-72 lg:h-[36rem]"
                    activeItemId={activeItemId}
                    completedItemIds={completedItemIds}
                    matchHeightTo={`live-day-items-${day.id}`}
                  />
                </aside>
              </div>}
            </section>
            );
          })}
          {tracking && !position && <p className="flex items-center gap-2 text-sm text-muted"><LocateFixed className="size-4 animate-pulse" aria-hidden="true" /> กำลังหาตำแหน่ง…</p>}
        </div>
      )}

      <Modal open={Boolean(replanning)} onClose={() => !working && setReplanning(null)} title={`เปลี่ยนแผน${replanning?.item.place ? ` · ${replanning.item.place.name}` : ""}`}>
        {replanning?.item.place && <NearbyPicker categories={NEARBY_CATEGORIES.map((category) => category.key)} initialCategory={replanCategory(replanning.item)} center={position ? { ...position.coords, label: "ตำแหน่งปัจจุบัน" } : { latitude: replanning.item.place.latitude, longitude: replanning.item.place.longitude, label: replanning.item.place.name }} group={replanning.item.place.category} excludeId={replanning.item.place.id} date={replanning.day.date} pickLabel={working ? "กำลังเปลี่ยน…" : "ใช้จุดนี้"} onPick={(place) => void pickReplacement(place)} />}
      </Modal>
    </div>
  );
}
