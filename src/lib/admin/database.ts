import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "@/lib/supabase";

export function adminDatabase() {
  const { url } = readEnv();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}
