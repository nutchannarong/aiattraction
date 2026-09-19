import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "thainhaidee-admin";
const TTL = 60 * 60 * 8;
const PASSWORD_HASH = "9789850896126f3e3d509898776426a5eb26e61d6fcf362bf74536efb5e8cca4d0b4c7eca0a078fd7bae862c1552d4ffa5e24d0de8bbdf68f844b8539f598e59";

export function sessionConfigured() {
  return (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
}

function signature(payload: string) {
  if (!sessionConfigured()) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(payload).digest("hex");
}

export function checkAdminPassword(username: string, password: string) {
  if (password.length > 200) return false;
  const hash = scryptSync(password, "thainhaidee-admin-v1", 64);
  return timingSafeEqual(hash, Buffer.from(PASSWORD_HASH, "hex")) && username === "admin";
}

export async function isAdmin() {
  if (!sessionConfigured()) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [expires, nonce, mac, extra] = token.split(".");
  if (extra || !/^\d+$/.test(expires) || !/^[a-f0-9]{32}$/.test(nonce ?? "") || !/^[a-f0-9]{64}$/.test(mac ?? "")) return false;
  const expiration = Number(expires);
  const now = Math.floor(Date.now() / 1000);
  if (expiration <= now || expiration > now + TTL) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(`${expires}.${nonce}`), "hex"));
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function createAdminSession() {
  const payload = `${Math.floor(Date.now() / 1000) + TTL}.${randomBytes(16).toString("hex")}`;
  (await cookies()).set(COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: TTL,
  });
}

export async function clearAdminSession() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: 0 });
}
