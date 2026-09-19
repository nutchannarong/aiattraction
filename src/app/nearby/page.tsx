import type { Metadata } from "next";
import { NearbyList } from "./nearby-list";

export const metadata: Metadata = { title: "สถานที่ท่องเที่ยวใกล้ฉัน" };

export default function NearbyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">สถานที่ท่องเที่ยวใกล้ฉัน</h1>
        <p className="text-sm text-muted">
          ใช้ตำแหน่งปัจจุบันของคุณเพื่อค้นหาสถานที่ใกล้เคียง ตำแหน่งจะไม่ถูกบันทึกไว้
        </p>
      </div>
      <NearbyList />
    </div>
  );
}
