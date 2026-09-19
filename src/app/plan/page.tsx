import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "วางแผนเที่ยว" };

export default function PlanPage() {
  return <ComingSoon title="วางแผนเที่ยว">ขั้นตอนวางแผน 5 ขั้นกำลังจะมาเร็ว ๆ นี้</ComingSoon>;
}
