"use client";

import { useEffect, useReducer, useRef } from "react";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { PlannerDraft, RouteStyle } from "@/lib/planner/types";
import { PLANNER_DRAFT_KEY, PLANNER_PLAN_KEY } from "./storage-keys";

/** One drafted route style, offered side by side so the user can pick. */
export type PlanOption = { style: RouteStyle; plan: TripPlan };
export type FailedOption = { style: RouteStyle; error: string };

export type SavedPlan = {
  version: 1;
  /** The answers the chosen plan was drafted from (routeStyle = the chosen option). */
  draft: PlannerDraft;
  /** The plan being edited. */
  plan: TripPlan;
  /** True once the user changed anything in the daily plan. */
  edited: boolean;
  /** Set after "สร้างแผนของฉัน" succeeded. */
  tripId: string | null;
  /** All drafted route options (absent on plans saved before options existed). */
  options?: PlanOption[];
  failed?: FailedOption[];
  /** Last change, ISO time; shown when asking whether to continue. */
  updatedAt?: string;
};

type Action =
  | { type: "set"; value: SavedPlan | null }
  | { type: "patch"; patch: Partial<SavedPlan> }
  | { type: "choose"; style: RouteStyle }
  | { type: "replaceOption"; option: PlanOption };

const now = () => new Date().toISOString();

function reducer(state: SavedPlan | null, action: Action): SavedPlan | null {
  switch (action.type) {
    case "set":
      return action.value;
    case "patch":
      return state && { ...state, ...action.patch, updatedAt: now() };
    case "choose": {
      if (!state?.options) return state;
      const target = state.options.find((o) => o.style === action.style);
      if (!target || state.draft.routeStyle === action.style) return state;
      // Keep edits made to the current option so switching back doesn't lose them.
      const options = state.options.map((o) =>
        o.style === state.draft.routeStyle ? { ...o, plan: state.plan } : o,
      );
      return {
        ...state,
        options,
        plan: target.plan,
        draft: { ...state.draft, routeStyle: action.style },
        tripId: null,
        updatedAt: now(),
      };
    }
    case "replaceOption": {
      if (!state) return state;
      const { option } = action;
      const options = state.options?.some((o) => o.style === option.style)
        ? state.options.map((o) => (o.style === option.style ? option : o))
        : [option, ...(state.options ?? [])];
      return {
        ...state,
        options,
        plan: option.plan,
        draft: { ...state.draft, routeStyle: option.style },
        edited: false,
        tripId: null,
        updatedAt: now(),
      };
    }
  }
}

/**
 * The drafted plan(s) and the user's edits, kept in localStorage so they survive a reload,
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
      const raw = localStorage.getItem(PLANNER_PLAN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedPlan;
      // Older saves may have left the browser draft behind. A persisted trip must
      // never be restored as a half-finished planner session.
      if (parsed?.tripId) {
        localStorage.removeItem(PLANNER_PLAN_KEY);
        localStorage.removeItem(PLANNER_DRAFT_KEY);
        return;
      }
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
      if (value) localStorage.setItem(PLANNER_PLAN_KEY, JSON.stringify(value));
      else localStorage.removeItem(PLANNER_PLAN_KEY);
    } catch {
      // Storage full or blocked; the plan still works until the tab closes.
    }
  }, [value]);

  return {
    saved: value,
    /** New drafts: the first option becomes the plan being edited. */
    startOptions: (draft: PlannerDraft, options: PlanOption[], failed: FailedOption[] = []) =>
      dispatch({
        type: "set",
        value: {
          version: 1,
          draft: { ...draft, routeStyle: options[0].style },
          plan: options[0].plan,
          edited: false,
          tripId: null,
          options,
          failed,
          updatedAt: now(),
        },
      }),
    choose: (style: RouteStyle) => dispatch({ type: "choose", style }),
    /** Re-drafted single option (e.g. custom route recalculated). */
    replaceOption: (option: PlanOption) => dispatch({ type: "replaceOption", option }),
    editPlan: (plan: TripPlan) => dispatch({ type: "patch", patch: { plan, edited: true } }),
    markSaved: (tripId: string) => dispatch({ type: "patch", patch: { tripId } }),
    clear: () => dispatch({ type: "set", value: null }),
  };
}
