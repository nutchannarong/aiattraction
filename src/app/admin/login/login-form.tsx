"use client";
import { useActionState } from "react";
import { adminLogin } from "./actions";
import { buttonClass } from "@/components/ui/button";

export function AdminLoginForm() {
  const [error, action, pending] = useActionState(adminLogin, "");
  const field = "mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4";
  return <form action={action} className="space-y-5">
    <label className="block text-sm font-semibold">ชื่อผู้ใช้<input className={field} defaultValue="admin" name="username" autoComplete="username" required maxLength={100} /></label>
    <label className="block text-sm font-semibold">รหัสผ่าน<input className={field} defaultValue="thainhaidee" name="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
    {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    <button disabled={pending} className={buttonClass("cta", "w-full cursor-pointer")}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบหลังบ้าน"}</button>
  </form>;
}
