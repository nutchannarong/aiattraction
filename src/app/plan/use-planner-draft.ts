"use client";

import { useEffect, useReducer, useRef } from "react";
import { isoDate } from "@/lib/planner/draft";
import type { PlannerDraft } from "@/lib/planner/types";
import { PLANNER_DRAFT_KEY } from "./storage-keys";

type Action =
  { type: "patch"; patch: Partial<PlannerDraft> } | { type: "replace"; draft: PlannerDraft };

function reducer(state: PlannerDraft, action: Action): PlannerDraft {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "replace":
      return action.draft;
  }
}

/** Planner state, restored from and saved to localStorage so a half-made plan survives a reload or sign-in. */
export function usePlannerDraft(initial: PlannerDraft) {
  const [draft, dispatch] = useReducer(reducer, initial);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(PLANNER_DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as PlannerDraft;
      if (parsed?.version !== 1) return;
      // Keep saved answers but never restore dates in the past.
      const today = isoDate(new Date());
      const fixed =
        parsed.startDate < today
          ? { ...parsed, startDate: initial.startDate, endDate: initial.endDate }
          : parsed;
      dispatch({
        type: "replace",
        draft: { ...initial, ...fixed, vehicle: { ...initial.vehicle, ...fixed.vehicle } },
      });
    } catch {
      // Corrupt or unavailable storage: start fresh.
    }
  }, [initial]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(PLANNER_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full or blocked; the draft still works for this visit.
    }
  }, [draft]);

  return {
    draft,
    patch: (patch: Partial<PlannerDraft>) => dispatch({ type: "patch", patch }),
    reset: () => dispatch({ type: "replace", draft: initial }),
  };
}
