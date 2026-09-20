import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase-server";
import { getMyTripSummaries } from "@/lib/trips-server";
import { NewTripButton } from "./new-trip-button";
import { TripsView } from "./trips-view";

export const metadata: Metadata = { title: "แผนของฉัน" };

export default async function TripsPage() {
  const user = await getCurrentUser();
  const trips = user ? await getMyTripSummaries() : [];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 size-72 rounded-full opacity-40"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, var(--secondary-soft) 0deg 12deg, transparent 12deg 24deg)",
          }}
        />
        <div className="relative z-10 px-6 py-7">
          <span className="inline-flex rounded-full border-[1.5px] border-foreground bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white dark:text-black">
            แผนของฉัน
          </span>
          <h1 className="mt-3 text-[clamp(30px,4.2vw,44px)] font-extrabold leading-tight tracking-tight">
            ทริปที่<span className="hl text-accent">กำลังจะถึง</span>
          </h1>
          <p className="mt-2 max-w-[58ch] text-muted">
            แผนที่บันทึกไว้อยู่ตรงนี้ กดเริ่มแผนเมื่อถึงวันเดินทาง ระบบจะพาเข้าสู่โหมดนำทางพร้อม GPS
          </p>
        </div>
      </section>
      <TripsView initialTrips={trips} isAuthenticated={Boolean(user)} />
      {user && (
        <div className="flex justify-center pt-2">
          <NewTripButton />
        </div>
      )}
    </div>
  );
}
