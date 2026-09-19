import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

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
  const previous=process.env.ADMIN_SESSION_SECRET; process.env.ADMIN_SESSION_SECRET="test-secret-with-at-least-32-characters-only";
  try {
    const {api,jar,options}=sessionModule();
    assert.equal(api.checkAdminPassword("admin","thainhaidee"),true);
    assert.equal(api.checkAdminPassword("user","thainhaidee"),false);
    assert.equal(api.checkAdminPassword("admin","wrong"),false);
    assert.equal(await api.isAdmin(),false);
    await assert.rejects(api.requireAdmin(),/redirect:\/admin\/login/);
    await api.createAdminSession();
    const original=jar.get("thainhaidee-admin");
    assert.equal(await api.isAdmin(),true);
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
  } finally { if(previous === undefined)delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET=previous; }
});
