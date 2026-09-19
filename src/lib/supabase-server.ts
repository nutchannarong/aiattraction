import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readEnv } from "./supabase";

/**
 * Per-request Supabase client bound to the auth cookies, for reading the
 * signed-in user and running auth actions. Public data queries use getSupabase().
 */
export async function createAuthClient() {
  const { url, key } = readEnv();
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.");
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
}
