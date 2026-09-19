"use client";

import { useEffect, useReducer, useRef } from "react";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { PlannerDraft } from "@/lib/planner/types";

const STORAGE_KEY = "thainhaidee:planner-plan";

export type SavedPlan = {
  version: 1;
  /** The answers the plan was drafted from. */
  draft: PlannerDraft;
  plan: TripPlan;
  /** True once the user changed anything in the daily plan. */
  edited: boolean;
  /** Set after "สร้างแผนของฉัน" succeeded. */
  tripId: string | null;
};

type Action =
  { type: "set"; value: SavedPlan | null } | { type: "patch"; patch: Partial<SavedPlan> };

function reducer(state: SavedPlan | null, action: Action): SavedPlan | null {
  switch (action.type) {
    case "set":
      return action.value;
    case "patch":
      return state && { ...state, ...action.patch };
  }
}

/**
 * The drafted plan and the user's edits, kept in localStorage so they survive a reload,
 * a trip to a booking site, or signing in before saving.
 */
export function useSavedPlan() {
  const [value, dispatch] = useReducer(reducer, null);
  const restored = useRef(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedPlan;
      if (parsed?.version === 1 && parsed.plan?.days?.length)
        dispatch({ type: "set", value: parsed });
    } catch {
      // Corrupt or blocked storage: nothing to restore.
    }
  }, []);

  useEffect(() => {
    // Skip the first pass so the empty initial state doesn't wipe what's being restored.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage full or blocked; the plan still works until the tab closes.
    }
  }, [value]);

  return {
    saved: value,
    start: (draft: PlannerDraft, plan: TripPlan) =>
      dispatch({ type: "set", value: { version: 1, draft, plan, edited: false, tripId: null } }),
    editPlan: (plan: TripPlan) => dispatch({ type: "patch", patch: { plan, edited: true } }),
    markSaved: (tripId: string) => dispatch({ type: "patch", patch: { tripId } }),
    clear: () => dispatch({ type: "set", value: null }),
  };
}
