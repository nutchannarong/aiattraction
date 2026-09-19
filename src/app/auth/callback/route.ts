import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase-server";

// Landing URL for the email confirmation link (PKCE code exchange).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const params = new URLSearchParams({
    error: "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบหรือสมัครใหม่อีกครั้ง",
  });
  return NextResponse.redirect(`${origin}/login?${params}`);
}
