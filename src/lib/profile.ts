import { cache } from "react";
import { createAuthClient, getCurrentUser } from "./supabase-server";
import { MOCK_PROFILE, MOCK_USER_ID } from "./mock-auth";

export type Gender = "male" | "female" | "other" | "unspecified";

export type Profile = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  gender: Gender | null;
  home_province_id: string | null;
  occupation: string | null;
  avatar_url: string | null;
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่น ๆ",
  unspecified: "ไม่ระบุ",
};

/** The signed-in user's profile, or null when signed out. */
export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.id === MOCK_USER_ID) return MOCK_PROFILE;

  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, birth_date, gender, home_province_id, occupation, avatar_url")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data;
});

/** A profile counts as complete once the fields the planner relies on are filled. */
export function isProfileComplete(p: Profile | null) {
  return Boolean(p?.full_name && p.birth_date && p.gender && p.home_province_id);
}

export function ageFromBirthDate(birthDate: string, today = new Date()) {
  const b = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - b.getFullYear();
  const beforeBirthday =
    today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
