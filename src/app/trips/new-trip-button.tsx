"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearPlannerStorage } from "@/app/plan/storage-keys";
import { Button } from "@/components/ui/button";

export function NewTripButton() {
  const router = useRouter();

  return (
    <Button
      onClick={() => {
        clearPlannerStorage();
        router.push("/plan?new=1");
      }}
    >
      <Plus className="size-4" aria-hidden="true" /> วางแผนเที่ยวเพิ่ม
    </Button>
  );
}
