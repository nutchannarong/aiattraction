"use client";

import { CheckCircle2, LocateFixed, MapPin, Navigation, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StickerCard } from "@/components/ui/sticker-card";
import { Toggle } from "@/components/ui/toggle";
import { distanceMeters, formatDistance, type Coordinates } from "@/lib/geo";
import { type LocalTrip, readActiveLocalTrip } from "@/lib/local-trips";

type PositionState = {
  coords: Coordinates;
  accuracy: number;
  updatedAt: number;
};

function thaiDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function navigationUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

export function LiveView() {
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [stopIndex, setStopIndex] = useState(0);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const active = readActiveLocalTrip();
      setTrip(active);
      if (active) {
        const saved = Number(localStorage.getItem(`thainhaidee:live-progress:${active.id}`));
        setStopIndex(Number.isInteger(saved) && saved >= 0 ? saved : 0);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

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
      (result) => {
        setPosition({
          coords: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          },
          accuracy: Math.round(result.coords.accuracy),
          updatedAt: result.timestamp,
        });
      },
      (error) => {
        setTracking(false);
        watchId.current = null;
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาต Location ในการตั้งค่าเว็บไซต์"
            : "ระบุตำแหน่งไม่สำเร็จ กรุณาตรวจว่าเปิดบริการตำแหน่งของเครื่องแล้ว",
        );
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
  };

  const stops = useMemo(
    () =>
      trip
        ? trip.plan.days.flatMap((day) =>
            day.items
              .filter((item) => item.place && item.kind !== "drive")
              .map((item) => ({ item, day })),
          )
        : [],
    [trip],
  );
  const currentStop = stops[stopIndex] ?? null;
  const stopOrder = useMemo(
    () => new Map(stops.map((stop, index) => [stop.item.id, index])),
    [stops],
  );
  const currentDistance =
    position && currentStop?.item.place
      ? distanceMeters(position.coords, {
          latitude: currentStop.item.place.latitude,
          longitude: currentStop.item.place.longitude,
        })
      : null;

  const moveToStop = (next: number) => {
    if (!trip) return;
    const bounded = Math.max(0, Math.min(stops.length, next));
    setStopIndex(bounded);
    localStorage.setItem(`thainhaidee:live-progress:${trip.id}`, String(bounded));
  };

  return (
    <div className="space-y-5">
      <StickerCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-sans text-sm font-bold sm:text-base">
              ติดตามตำแหน่งแบบต่อเนื่อง (GPS)
            </h2>
            <p className="mt-0.5 text-xs text-subtle sm:text-sm">
              ใช้ Geolocation API ของเบราว์เซอร์จริง ตำแหน่งไม่ถูกส่งออกไปไหน
            </p>
          </div>
          <Toggle
            label="ติดตามตำแหน่งแบบต่อเนื่อง"
            hideLabel
            checked={tracking}
            onChange={setTrackingEnabled}
          />
        </div>
        {position ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-3 font-mono text-xs text-muted">
            พิกัดปัจจุบัน {position.coords.latitude.toFixed(5)}, {position.coords.longitude.toFixed(5)} · ความแม่นยำ ±{position.accuracy.toLocaleString("th-TH")} ม. · อัปเดต {new Date(position.updatedAt).toLocaleTimeString("th-TH")}
          </div>
        ) : (
          <p className="mt-4 text-xs text-subtle">กดสวิตช์เพื่อเริ่มติดตามตำแหน่ง</p>
        )}
        {geoError && (
          <div className="mt-3">
            <Callout tone="danger">{geoError}</Callout>
          </div>
        )}
      </StickerCard>

      {!loaded ? (
        <div className="h-48 animate-pulse rounded-card border-2 border-foreground bg-surface" />
      ) : !trip ? (
        <StickerCard className="px-5 py-14 text-center text-subtle">
          <h2 className="text-lg font-bold">ยังไม่มีแผนที่เลือกไว้</h2>
          <p className="mt-2 text-sm">ไปที่ “แผนของฉัน” แล้วกดเริ่มแผน</p>
          <Link href="/trips" className={buttonClass("ghost", "mt-4")}>
            ไปแผนของฉัน
          </Link>
        </StickerCard>
      ) : (
        <div className="space-y-4">
          <StickerCard className="p-5">
            <p className="text-xs font-semibold text-accent">แผนที่กำลังเดินทาง</p>
            <h2 className="mt-1 text-xl font-bold">
              {trip.draft.origin?.label} → {trip.draft.destination?.label}
            </h2>
          </StickerCard>

          {currentStop?.item.place ? (
            <section className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-active">
              <div className="border-b-2 border-foreground bg-accent-soft px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">
                  จุดถัดไป {stopIndex + 1} / {stops.length}
                </p>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-xs text-subtle">
                    วันที่ {currentStop.day.index + 1} · {thaiDate(currentStop.day.date)} · {currentStop.item.start ?? "ไม่ระบุเวลา"}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold">
                    <MapPin className="size-5 flex-none text-accent" aria-hidden="true" />
                    {currentStop.item.place.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {[currentStop.item.activity, currentStop.item.place.area]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {currentDistance != null && (
                    <p className="mt-3 font-mono text-sm font-semibold text-info">
                      ห่างจากคุณ {formatDistance(currentDistance)}
                    </p>
                  )}
                  {currentDistance != null && currentDistance <= Math.max(150, position!.accuracy * 2) && (
                    <p className="mt-2 text-sm font-semibold text-secondary">
                      คุณอยู่ใกล้จุดหมายแล้ว — กด “ถึงแล้ว” เพื่อไปจุดต่อไป
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={navigationUrl(
                      currentStop.item.place.latitude,
                      currentStop.item.place.longitude,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("ink")}
                  >
                    <Navigation className="size-4" aria-hidden="true" /> นำทางไปจุดนี้
                  </a>
                  <button
                    type="button"
                    className={buttonClass("cta")}
                    onClick={() => moveToStop(stopIndex + 1)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" /> ถึงแล้ว ไปจุดถัดไป
                  </button>
                  <button
                    type="button"
                    className="min-h-9 text-xs font-semibold text-subtle underline"
                    onClick={() => moveToStop(stopIndex + 1)}
                  >
                    ข้ามจุดนี้
                  </button>
                </div>
              </div>
            </section>
          ) : stops.length > 0 ? (
            <StickerCard className="p-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-secondary" aria-hidden="true" />
              <h2 className="mt-2 text-xl font-bold">เดินทางครบทุกจุดแล้ว</h2>
              <p className="mt-1 text-sm text-muted">จบทริปเรียบร้อย ขอให้เดินทางกลับโดยสวัสดิภาพ</p>
              <button
                type="button"
                className={buttonClass("ghost", "mt-4")}
                onClick={() => moveToStop(0)}
              >
                <RotateCcw className="size-4" aria-hidden="true" /> เริ่มลำดับใหม่
              </button>
            </StickerCard>
          ) : null}

          {trip.plan.days.map((day) => (
            <section
              key={day.index}
              className="overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard"
            >
              <header className="border-b-2 border-foreground bg-surface-2 px-4 py-3">
                <h3 className="text-base font-bold">
                  วันที่ {day.index + 1} · {thaiDate(day.date)}
                </h3>
              </header>
              <ol className="divide-y divide-dashed divide-border px-4">
                {day.items.map((item) => {
                  const order = stopOrder.get(item.id);
                  const isPast = order != null && order < stopIndex;
                  const isCurrent = order === stopIndex;
                  const distance =
                    position && item.place
                      ? distanceMeters(position.coords, {
                          latitude: item.place.latitude,
                          longitude: item.place.longitude,
                        })
                      : null;
                  return (
                    <li
                      key={item.id}
                      className={`grid gap-3 py-3 sm:grid-cols-[76px_1fr_auto] sm:items-center ${
                        isPast ? "opacity-45" : ""
                      } ${isCurrent ? "-mx-2 rounded-lg bg-accent-soft px-2" : ""}`}
                    >
                      <span className="font-mono text-xs font-semibold text-secondary">
                        {item.start ?? "--:--"}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          {isPast ? (
                            <CheckCircle2 className="size-3.5 flex-none text-secondary" aria-hidden="true" />
                          ) : (
                            <MapPin className="size-3.5 flex-none" aria-hidden="true" />
                          )}
                          {item.place?.name ?? item.activity}
                          {isCurrent && (
                            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white dark:text-black">
                              จุดถัดไป
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {[item.activity, item.place?.area, distance != null ? `ห่าง ${formatDistance(distance)}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {item.warning && <p className="mt-1 text-xs font-semibold text-danger">{item.warning}</p>}
                      </div>
                      {item.place && isCurrent && (
                        <a
                          href={navigationUrl(item.place.latitude, item.place.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClass("mini")}
                        >
                          <Navigation className="size-3.5" aria-hidden="true" /> นำทาง
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {tracking && !position && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LocateFixed className="size-4 animate-pulse" aria-hidden="true" /> กำลังหาตำแหน่ง…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
