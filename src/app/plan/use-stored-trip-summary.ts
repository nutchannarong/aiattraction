"use client";

import { useSyncExternalStore } from "react";
import { PLANNER_DRAFT_KEY, PLANNER_PLAN_KEY } from "./storage-keys";

type StoredDraft = {
  origin?: { label?: string } | null;
  destination?: { label?: string } | null;
  startDate?: string;
  endDate?: string;
};
type StoredPlan = {
  draft?: StoredDraft;
  plan?: { days?: unknown[] };
  options?: unknown[];
  updatedAt?: string;
};

function read(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * One-line description of the half-made plan left in this browser, or null when there is
 * nothing worth resuming. A string, so React can compare snapshots without re-rendering.
 */
function snapshot(): string | null {
  const plan = read(PLANNER_PLAN_KEY) as StoredPlan | null;
  const draft = (plan?.draft ?? read(PLANNER_DRAFT_KEY)) as StoredDraft | null;
  const from = draft?.origin?.label;
  const to = draft?.destination?.label;
  if (!from && !to) return null;
  const parts = [`${from ?? "?"} → ${to ?? "?"}`];
  const days = plan?.plan?.days?.length;
  if (days) {
    parts.push(`${days} วัน`);
    parts.push(
      (plan?.options?.length ?? 0) > 1
        ? `ร่างไว้ ${plan!.options!.length} แบบเส้นทาง`
        : "ร่างแผนแล้ว",
    );
  } else {
    parts.push("กรอกคำตอบไว้ ยังไม่ได้ร่างแผน");
  }
  if (plan?.updatedAt) {
    parts.push(
      `แก้ล่าสุด ${new Date(plan.updatedAt).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    );
  }
  return parts.join(" · ");
}

// Frozen for the visit: what was left over when the page opened, not what the user types
// afterwards. Cleared when the planner unmounts so the next visit reads storage again.
let cached: { value: string | null } | null = null;

function subscribe() {
  return () => {
    cached = null;
  };
}

function getSnapshot() {
  cached ??= { value: snapshot() };
  return cached.value;
}

/** What was left in this browser when /plan opened; null during server rendering. */
export function useStoredTripSummary() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
