import { createAuthClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return new Response(null, { status: 413 });
  try {
    const { session } = await request.json();
    if (typeof session !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session)) return new Response(null, { status: 400 });
    const db = await createAuthClient();
    const { data } = await db.auth.getClaims();
    if (!data?.claims) return new Response(null, { status: 401 });
    const { error } = await db.rpc("record_activity", { p_session: session });
    return new Response(null, { status: error ? 503 : 204 });
  } catch { return new Response(null, { status: 400 }); }
}
