"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { z } from "zod";
import { getProvinces } from "@/lib/provinces";
import { createAuthClient, getCurrentUser } from "@/lib/supabase-server";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "กรุณากรอกชื่อ-นามสกุล").max(100, "ชื่อยาวเกินไป"),
  birth_date: z.iso.date("กรุณาเลือกวันเกิด").refine((d) => {
    const date = new Date(`${d}T00:00:00`);
    return date.getFullYear() >= 1900 && date <= new Date();
  }, "วันเกิดไม่ถูกต้อง"),
  gender: z.enum(["male", "female", "other", "unspecified"], "กรุณาเลือกเพศ"),
  home_province_id: z.string().min(1, "กรุณาเลือกจังหวัดบ้านเกิด"),
  occupation: z.string().trim().max(100, "อาชีพยาวเกินไป"),
});

export async function saveProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const next = safeNext(formData.get("next"), "");
  const back = (params: Record<string, string>) =>
    `/profile?${new URLSearchParams({ ...params, ...(next ? { next } : {}) })}`;

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    birth_date: formData.get("birth_date") ?? "",
    gender: formData.get("gender") ?? "",
    home_province_id: formData.get("home_province_id") ?? "",
    occupation: formData.get("occupation") ?? "",
  });
  if (!parsed.success) redirect(back({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }));

  const provinces = await getProvinces();
  if (!provinces.some((p) => p.id === parsed.data.home_province_id)) {
    redirect(back({ error: "จังหวัดบ้านเกิดไม่ถูกต้อง" }));
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    ...parsed.data,
    occupation: parsed.data.occupation || null,
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(back({ error: `บันทึกไม่สำเร็จ: ${error.message}` }));

  redirect(next || back({ saved: "1" }));
}
