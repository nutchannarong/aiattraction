import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createHmac, scryptSync } from "node:crypto";

const require = createRequire(import.meta.url);
// Execute the actual server module with only Next's request-cookie API stubbed.
function sessionModule() {
  const jar = new Map(); const options = new Map(); const mod = {exports:{}};
  const js = ts.transpileModule(readFileSync(new URL("../src/lib/admin/session.ts",import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const resolver = name => name === "server-only" ? {} : name === "next/headers" ? {cookies:async()=>({get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v,o)=>{jar.set(k,v);options.set(k,o);}})} : name === "next/navigation" ? {redirect:path=>{throw new Error(`redirect:${path}`)}} : require(name);
  new Function("require","module","exports",js)(resolver,mod,mod.exports);
  return {api:mod.exports,jar,options};
}
test("admin password, cookie flags, tamper/expiry rejection and logout", async () => {
  const previous = Object.fromEntries(["ADMIN_SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"].map(k => [k, process.env[k]]));
  process.env.ADMIN_SESSION_SECRET="test-secret-with-at-least-32-characters-only";
  process.env.ADMIN_USERNAME="test-owner";
  const password = "test-only-long-random-password";
  const salt = "1234567890abcdef1234567890abcdef";
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
  process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${hash}`;
  try {
    const {api,jar,options}=sessionModule();
    assert.equal(await api.checkAdminPassword("test-owner",password),true);
    assert.equal(await api.checkAdminPassword("user",password),false);
    assert.equal(await api.checkAdminPassword("test-owner","wrong-password-with-length"),false);
    assert.equal(await api.checkAdminPassword("admin","thainhaidee"),false);
    assert.equal(await api.isAdmin(),false);
    await assert.rejects(api.requireAdmin(),/redirect:\/admin\/login/);
    await api.createAdminSession();
    const original=jar.get("thainhaidee-admin");
    assert.equal(await api.isAdmin(),true);
    const payload = original.split('.').slice(0,2).join('.');
    const oldMac = createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("hex");
    jar.set("thainhaidee-admin", `${payload}.${oldMac}`);
    assert.equal(await api.isAdmin(),false, "legacy cookies must be revoked");
    jar.set("thainhaidee-admin", original);
    const originalHash = process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD_HASH = `scrypt:${salt}:${"a".repeat(128)}`;
    assert.equal(await api.isAdmin(),false, "password rotation must revoke sessions");
    process.env.ADMIN_PASSWORD_HASH = originalHash;
    assert.equal(options.get("thainhaidee-admin").httpOnly,true);
    assert.equal(options.get("thainhaidee-admin").sameSite,"strict");
    assert.equal(options.get("thainhaidee-admin").path,"/admin");
    jar.set("thainhaidee-admin",original.slice(0,-1)+(original.endsWith("a")?"b":"a"));
    assert.equal(await api.isAdmin(),false);
    jar.set("thainhaidee-admin",`1.${original.split('.').slice(1).join('.')}`);
    assert.equal(await api.isAdmin(),false);
    jar.set("thainhaidee-admin",original+".extra");
    assert.equal(await api.isAdmin(),false);
    jar.set("thainhaidee-admin",original);
    process.env.ADMIN_SESSION_SECRET="different-secret-with-at-least-32-characters";
    assert.equal(await api.isAdmin(),false);
    await api.clearAdminSession();assert.equal(await api.isAdmin(),false);
    delete process.env.ADMIN_SESSION_SECRET;assert.equal(await api.isAdmin(),false);
    delete process.env.ADMIN_PASSWORD_HASH;
    assert.equal(api.sessionConfigured(), false);
    assert.equal(await api.checkAdminPassword("test-owner", password), false);
  } finally { for (const [key,value] of Object.entries(previous)) { if(value === undefined) delete process.env[key]; else process.env[key]=value; } }
});
