import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// Run locally. Never put a password on the command line or in source control.
const username = process.argv[2];
if (!username || !/^[a-zA-Z0-9_.@-]{3,100}$/.test(username)) {
  throw new Error("Usage: node scripts/configure-admin.mjs <username> (3–100 letters, digits, _.@-)");
}
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
const values = {
  ADMIN_USERNAME: username,
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${hash}`,
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
};
const path = new URL("../.env.local", import.meta.url);
let env = "";
try { env = readFileSync(path, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
}
writeFileSync(path, env, { mode: 0o600 });
console.log(`Admin username: ${username}\nAdmin password: ${password}\n`);
console.log("Saved credentials to .env.local. Store this password in your password manager.");
console.log("For production, copy the three ADMIN_* values to the hosting secret settings and redeploy.");
console.log("Restart the local server. Previous admin sessions are now invalid.");
