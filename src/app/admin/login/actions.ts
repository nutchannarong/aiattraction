"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { checkAdminPassword, createAdminSession, clearAdminSession, sessionConfigured } from "@/lib/admin/session";
import { adminDatabase } from "@/lib/admin/database";

export async function adminLogin(_state: string, form: FormData): Promise<string> {
  if (!sessionConfigured()) return "ระบบหลังบ้านยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  const db = adminDatabase();
  if (!db) return "ยังไม่ได้ตั้งค่า Supabase secret key สำหรับระบบหลังบ้าน";
  // All attempts target the configured account, never a caller-supplied identity.
  const key = createHash("sha256").update(`admin-account:${process.env.ADMIN_USERNAME}`).digest("hex");
  let result;
  try { result = await db.rpc("admin_login_attempt", { p_key: key }); }
  catch { return "ระบบเข้าสู่ระบบไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง"; }
  const { data: allowed, error } = result;
  if (error) return "ยังไม่พร้อมเข้าสู่ระบบ กรุณาติดตั้ง migration ของระบบหลังบ้าน";
  if (allowed !== true) return "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที";
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!(await checkAdminPassword(username, password))) return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}
