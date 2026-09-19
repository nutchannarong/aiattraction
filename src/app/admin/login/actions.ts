"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAdminPassword, createAdminSession, clearAdminSession, sessionConfigured } from "@/lib/admin/session";
import { adminDatabase } from "@/lib/admin/database";

export async function adminLogin(_state: string, form: FormData): Promise<string> {
  if (!sessionConfigured()) return "ยังไม่ได้ตั้งค่า ADMIN_SESSION_SECRET บนเซิร์ฟเวอร์";
  const db = adminDatabase();
  if (!db) return "ยังไม่ได้ตั้งค่า Supabase secret key สำหรับระบบหลังบ้าน";
  const h = await headers();
  const ip = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "local";
  const key = createHash("sha256").update(ip.split(",")[0].trim()).digest("hex");
  const { data: allowed, error } = await db.rpc("admin_login_attempt", { p_key: key });
  if (error) return "ยังไม่พร้อมเข้าสู่ระบบ กรุณาติดตั้ง migration ของระบบหลังบ้าน";
  if (!allowed) return "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที";
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!checkAdminPassword(username, password)) return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}
