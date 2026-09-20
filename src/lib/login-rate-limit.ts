import "server-only";
import { createHash } from "node:crypto";
import { adminDatabase } from "@/lib/admin/database";

/** Shared 10-attempt / 15-minute account bucket; never trust a caller's IP. */
export async function checkLoginLimit(email: string): Promise<"allowed" | "limited" | "unavailable"> {
  // Same identity as the email submitted to Auth. Separate namespace from admin buckets.
  const key = createHash("sha256").update(`user-login:${email.trim().toLowerCase()}`).digest("hex");
  try {
    const db = adminDatabase();
    if (!db) return "unavailable";
    // Reuse the existing atomic, service-role-only attempt counter.
    const { data, error } = await db.rpc("admin_login_attempt", { p_key: key });
    if (error || typeof data !== "boolean") return "unavailable";
    return data ? "allowed" : "limited";
  } catch {
    return "unavailable";
  }
}
