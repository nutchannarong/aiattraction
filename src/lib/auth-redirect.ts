import { isProfileComplete, type Profile } from "./profile";
import { createAuthClient } from "./supabase-server";

/** Where to send a user who just signed in: complete the profile first if needed. */
export async function destinationAfterSignIn(next: string): Promise<string> {
  const supabase = await createAuthClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return next;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, birth_date, gender, home_province_id, occupation, avatar_url")
    .eq("id", userId)
    .maybeSingle<Profile>();
  return isProfileComplete(data) ? next : `/profile?${new URLSearchParams({ next, welcome: "1" })}`;
}
