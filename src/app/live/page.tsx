import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "กำลังเดินทาง" };

export default function LivePage() {
  return (
    <ComingSoon title="กำลังเดินทาง">
      โหมดนำทางพร้อม GPS แบบ real-time บอกระยะถึงจุดถัดไป และปุ่มเปลี่ยนแผนเมื่อสถานที่ปิด
    </ComingSoon>
  );
}
