import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isAdmin } from "@/lib/admin/session";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return <section className="mx-auto my-10 max-w-md rounded-2xl border-2 border-foreground bg-surface p-7 shadow-hard">
    <ShieldCheck className="mb-4 size-10 text-accent" aria-hidden="true" />
    <p className="text-xs font-bold uppercase tracking-widest text-accent">Thainhaidee · Admin</p>
    <h1 className="mt-2 text-2xl font-bold">เข้าสู่ระบบหลังบ้าน</h1>
    <p className="mb-7 mt-2 text-sm text-muted">รายงานการใช้งานและการวางแผนท่องเที่ยว สำหรับผู้ดูแลระบบ</p>
    <AdminLoginForm />
  </section>;
}
