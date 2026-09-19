import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "แผนของฉัน" };

export default function TripsPage() {
  return (
    <ComingSoon title="แผนของฉัน">
      ทริปที่บันทึกไว้จะแสดงที่นี่ พร้อมนับถอยหลังวันเดินทาง และปุ่มเริ่มแผนเมื่อถึงวัน
    </ComingSoon>
  );
}
