import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "thainhaidee_admin_auth";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Configure it in .env.local before starting the app.`);
  return value;
}

function sign(value: string) {
  return createHmac("sha256", getRequiredEnv("ADMIN_SESSION_SECRET")).update(value).digest("base64url");
}

function makeToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin:${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const [, expiry] = payload.split(":");
  return payload.startsWith("admin:") && Number(expiry) > Math.floor(Date.now() / 1000);
}

export function isAdminCredentialValid(username: string, password: string) {
  return username === getRequiredEnv("ADMIN_USERNAME") && password === getRequiredEnv("ADMIN_PASSWORD");
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isValidToken(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function setAdminAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/admin",
  });
}

export async function clearAdminAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
