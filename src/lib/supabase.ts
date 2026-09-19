import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

// Only server components query Supabase, so server-only names are preferred.
// These match what the Vercel Supabase integration sets; NEXT_PUBLIC_* is a fallback.
export function readEnv() {
  const env = process.env;
  return {
    url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      env.SUPABASE_PUBLISHABLE_KEY ??
      env.SUPABASE_ANON_KEY ??
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// Created on first use so `next build` doesn't need the env vars to be present.
export function getSupabase() {
  if (client) return client;

  const { url, key } = readEnv();
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Set them in .env.local (local) or in Vercel → Settings → Environment Variables.",
    );
  }

  // Data is read-only public content, so no user session is needed.
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
