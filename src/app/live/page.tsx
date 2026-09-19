import type { Metadata } from "next";
import { LiveView } from "./live-view";

export const metadata: Metadata = { title: "กำลังเดินทาง" };

export default function LivePage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 size-72 rounded-full opacity-40"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, var(--accent-soft) 0deg 12deg, transparent 12deg 24deg)",
          }}
        />
        <div className="relative z-10 px-6 py-7">
          <span className="inline-flex rounded-full border-[1.5px] border-foreground bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white dark:text-black">
            กำลังเดินทาง
          </span>
          <h1 className="mt-3 text-[clamp(30px,4.2vw,44px)] font-extrabold leading-tight tracking-tight">
            โหมด<span className="hl text-accent">นำทาง</span>สด
          </h1>
          <p className="mt-2 max-w-[58ch] text-muted">
            ระบบติดตามตำแหน่งแบบต่อเนื่อง บอกระยะถึงจุดถัดไป ถ้าที่ไหนปิดหรือไปไม่ทัน กดเปลี่ยนแผนได้ทันที
          </p>
        </div>
      </section>
      <LiveView />
    </div>
  );
}
