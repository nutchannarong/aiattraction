import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/lib/supabase";

// Refreshes the Supabase auth session cookie on every page request.
export async function proxy(request: NextRequest) {
  // If our redirect URL isn't in Supabase's allow list, Supabase falls back to the
  // Site URL and the auth code lands on some other page. Hand it to the callback.
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const callback = new URL("/auth/callback", request.nextUrl.origin);
    callback.searchParams.set("code", code);
    callback.searchParams.set("next", pathname);
    return NextResponse.redirect(callback);
  }

  // The search page moved from / to /attractions; keep old shared links working.
  if (pathname === "/" && ["q", "category", "type", "province", "page"].some((k) => searchParams.has(k))) {
    const moved = request.nextUrl.clone();
    moved.pathname = "/attractions";
    return NextResponse.redirect(moved, 308);
  }

  let response = NextResponse.next({ request });
  const { url, key } = readEnv();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Must run before the response is returned so a refreshed token gets written.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
