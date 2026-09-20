import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "thainhaidee-admin";
const TTL = 60 * 60 * 8;
function credentials() {
  const username = process.env.ADMIN_USERNAME;
  const encoded = process.env.ADMIN_PASSWORD_HASH;
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded ?? "");
  if (!username || username.length > 100 || username !== username.trim() || !match) return null;
  return { username, salt: match[1], hash: match[2], encoded: encoded! };
}

export function sessionConfigured() {
  return (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32 && credentials() !== null;
}

function signature(payload: string) {
  if (!sessionConfigured()) throw new Error("Admin credentials or session secret are not configured");
  // Credential rotation revokes existing sessions, including old v1 cookies.
  const account = credentials()!;
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET!)
    .update(JSON.stringify(["admin-v2", account.username, account.encoded, payload])).digest("hex");
}

export async function checkAdminPassword(username: string, password: string) {
  const account = credentials();
  if (!account || password.length < 16 || password.length > 200 || username.length > 100) return false;
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, account.salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => error ? reject(error) : resolve(result));
  });
  const usernameMatches = timingSafeEqual(
    createHash("sha256").update(username).digest(),
    createHash("sha256").update(account.username).digest(),
  );
  return timingSafeEqual(hash, Buffer.from(account.hash, "hex")) && usernameMatches;
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
