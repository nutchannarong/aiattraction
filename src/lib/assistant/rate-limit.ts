import "server-only";
import { createAuthClient } from "@/lib/supabase-server";
import { adminDatabase } from "@/lib/admin/database";

function denied(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Reserve the maximum model calls before starting paid work. Fail closed. */
export async function authorizeAi(modelCalls: number): Promise<Response | null> {
  try {
    const auth = await createAuthClient();
    const { data, error } = await auth.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) {
      return denied("กรุณาเข้าสู่ระบบก่อนใช้ผู้ช่วย AI", 401);
    }
    const db = adminDatabase();
    if (!db) return denied("ผู้ช่วย AI ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง", 503);
    const { data: allowed, error: quotaError } = await db.rpc("consume_ai_quota", {
      p_user: data.user.id, p_model_calls: modelCalls,
    });
    if (quotaError || typeof allowed !== "boolean") {
      return denied("ผู้ช่วย AI ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง", 503);
    }
    return allowed ? null : denied("ใช้โควตา AI ครบแล้ว กรุณาลองใหม่ภายหลัง", 429);
  } catch {
    return denied("ผู้ช่วย AI ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง", 503);
  }
}
