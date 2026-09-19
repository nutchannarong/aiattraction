"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { destinationAfterSignIn } from "@/lib/auth-redirect";
import { createAuthClient, isAuthProviderEnabled } from "@/lib/supabase-server";
import {
  clearMockUser,
  getMockUser,
  MOCK_EMAIL,
  MOCK_PASSWORD,
  setMockUser,
} from "@/lib/mock-auth";

/** Only allow same-site relative paths to avoid open redirects. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function loginUrl(params: Record<string, string>) {
  return `/login?${new URLSearchParams(params)}`;
}

async function getOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

const ERROR_TH: Record<string, string> = {
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  email_not_confirmed: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมายของคุณ)",
  user_already_exists: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ",
  weak_password: "รหัสผ่านสั้นหรือคาดเดาง่ายเกินไป",
  over_email_send_rate_limit: "ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  over_request_rate_limit: "มีการร้องขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
};

function describeError(error: { code?: string; message: string }) {
  return (error.code && ERROR_TH[error.code]) || error.message;
}

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const { email, password } = readCredentials(formData);
  if (!email || !password) redirect(loginUrl({ error: "กรุณากรอกอีเมลและรหัสผ่าน", next }));

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(loginUrl({ error: describeError(error), email, next }));

  redirect(await destinationAfterSignIn(next));
}

export async function signUp(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const { email, password } = readCredentials(formData);
  if (!email || password.length < 6) {
    redirect(loginUrl({ error: "กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร", email, next }));
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(await getOrigin(), next) },
  });
  if (error) redirect(loginUrl({ error: describeError(error), email, next }));

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) {
    redirect(loginUrl({ message: "สมัครสำเร็จ กรุณายืนยันอีเมลจากลิงก์ที่ส่งไปให้", email, next }));
  }
  redirect(next);
}

const PROVIDER_LABEL = { google: "Google", facebook: "Facebook" } as const;
type OAuthProvider = keyof typeof PROVIDER_LABEL;

async function signInWithOAuthProvider(provider: OAuthProvider, formData: FormData) {
  const next = safeNext(formData.get("next"));
  const label = PROVIDER_LABEL[provider];
  // signInWithOAuth only builds a URL; check first so users get a clear message
  // instead of a raw JSON error page from Supabase.
  if (!(await isAuthProviderEnabled(provider))) {
    redirect(loginUrl({ error: `ยังไม่ได้เปิดการเข้าสู่ระบบด้วย ${label} กรุณาใช้วิธีอื่น`, next }));
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(await getOrigin(), next) },
  });
  if (error || !data.url) {
    redirect(loginUrl({ error: error ? describeError(error) : `เข้าสู่ระบบด้วย ${label} ไม่สำเร็จ`, next }));
  }
  redirect(data.url);
}

export async function signInWithGoogle(formData: FormData) {
  await signInWithOAuthProvider("google", formData);
}

export async function signInWithFacebook(formData: FormData) {
  await signInWithOAuthProvider("facebook", formData);
}

export async function signOut() {
  const mockUser = await getMockUser();
  await clearMockUser();
  if (mockUser) redirect("/");

  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInAsDemo(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (
    process.env.NODE_ENV !== "development" ||
    formData.get("email") !== MOCK_EMAIL ||
    formData.get("password") !== MOCK_PASSWORD
  ) {
    redirect(loginUrl({ error: "อีเมลหรือรหัสผ่านบัญชีทดลองไม่ถูกต้อง", next }));
  }
  await setMockUser();
  redirect(next);
}
