"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const DRAFT_KEY = "thainhaidee:planner-draft";
const PLAN_KEY = "thainhaidee:planner-plan";

export function NewTripButton() {
  const router = useRouter();

  return (
    <Button
      onClick={() => {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(PLAN_KEY);
        router.push("/plan");
      }}
    >
      <Plus className="size-4" aria-hidden="true" /> วางแผนเที่ยวเพิ่ม
    </Button>
  );
}
