import { cookies } from "next/headers";

export const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";
export const MOCK_EMAIL = "demo@thainhaidee.local";
export const MOCK_PASSWORD = "demo1234";
const MOCK_AUTH_COOKIE = "thainhaidee_mock_auth";

export const MOCK_USER = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
};

export const MOCK_PROFILE = {
  id: MOCK_USER_ID,
  full_name: "ผู้ใช้ทดลอง ไทยไหนดี",
  birth_date: "1992-06-15",
  gender: "unspecified" as const,
  home_province_id: "10",
  occupation: "นักเดินทางทดลอง",
  avatar_url: null,
};

export function isMockAuthEnabled() {
  return process.env.NODE_ENV === "development";
}

export async function getMockUser() {
  if (!isMockAuthEnabled()) return null;
  const cookieStore = await cookies();
  return cookieStore.get(MOCK_AUTH_COOKIE)?.value === "1" ? MOCK_USER : null;
}

export async function setMockUser() {
  if (!isMockAuthEnabled()) return;
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearMockUser() {
  if (!isMockAuthEnabled()) return;
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_AUTH_COOKIE);
}
