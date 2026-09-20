import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { destinationAfterSignIn } from "@/lib/auth-redirect";
import { createAuthClient } from "@/lib/supabase-server";
import { recordAnalyticsEvent } from "@/lib/analytics";

// Landing URL for email confirmation links and OAuth sign-in (PKCE code exchange).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordAnalyticsEvent("login");
      return NextResponse.redirect(`${origin}${await destinationAfterSignIn(next)}`);
    }
    console.error("exchangeCodeForSession failed:", error.message);
  }

  // e.g. the user pressed "Cancel" on Google's consent screen.
  const providerError = searchParams.get("error");
  const message =
    providerError === "access_denied"
      ? "ยกเลิกการเข้าสู่ระบบแล้ว"
      : "เข้าสู่ระบบไม่สำเร็จ หรือลิงก์หมดอายุ กรุณาลองใหม่อีกครั้ง";
  const params = new URLSearchParams({ error: message, next });
  return NextResponse.redirect(`${origin}/login?${params}`);
}
