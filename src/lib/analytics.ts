import "server-only";
import { createAuthClient } from "./supabase-server";

export async function recordAnalyticsEvent(kind: "login" | "plan_created") {
  try {
    const db = await createAuthClient();
    await db.rpc("record_analytics_event", { p_kind: kind });
  } catch { /* Analytics must never prevent login or planning. */ }
}
