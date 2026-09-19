// Browser storage used by the planner, in one place so "start a new plan" clears it all.

export const PLANNER_DRAFT_KEY = "thainhaidee:planner-draft";
export const PLANNER_PLAN_KEY = "thainhaidee:planner-plan";
/** sessionStorage: the assistant chat for this tab. */
export const ASSISTANT_CHAT_KEY = "thainhaidee:assistant-chat";

/** Forgets the half-made plan, its drafted routes and the assistant chat. */
export function clearPlannerStorage() {
  try {
    localStorage.removeItem(PLANNER_DRAFT_KEY);
    localStorage.removeItem(PLANNER_PLAN_KEY);
    sessionStorage.removeItem(ASSISTANT_CHAT_KEY);
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}
