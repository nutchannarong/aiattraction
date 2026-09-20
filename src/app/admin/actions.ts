"use server";

import { redirect } from "next/navigation";
import { clearAdminAuthenticated, isAdminCredentialValid, setAdminAuthenticated } from "@/lib/admin-auth";

export async function adminSignIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!isAdminCredentialValid(username, password)) redirect("/admin/login?error=ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  await setAdminAuthenticated();
  redirect("/admin");
}

export async function adminSignOut() {
  await clearAdminAuthenticated();
  redirect("/admin/login");
}
