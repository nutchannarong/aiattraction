import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

test("login buckets normalize emails, separate accounts, and fail closed", async () => {
  const keys = [];
  let result = { data: true, error: null }, available = true;
  const mocks = { "@/lib/admin/database": { adminDatabase: () => available ? {
    rpc: async (name, args) => {
      assert.equal(name, "admin_login_attempt"); keys.push(args.p_key);
      if (result instanceof Error) throw result;
      return result;
    },
  } : null } };
  const { checkLoginLimit } = loadTs("src/lib/login-rate-limit.ts", mocks);
  assert.equal(await checkLoginLimit(" Person@Example.com "), "allowed");
  await loadTs("src/lib/login-rate-limit.ts", mocks).checkLoginLimit("person@example.com");
  await checkLoginLimit("other@example.com");
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[0], keys[2]);
  assert.match(keys[0], /^[a-f0-9]{64}$/);
  result = { data: false, error: null };
  assert.equal(await checkLoginLimit("person@example.com"), "limited");
  for (const value of [null, "true", undefined]) {
    result = { data: value, error: null };
    assert.equal(await checkLoginLimit("person@example.com"), "unavailable");
  }
  result = { data: true, error: { message: "database unavailable" } };
  assert.equal(await checkLoginLimit("person@example.com"), "unavailable");
  result = new Error("network down");
  assert.equal(await checkLoginLimit("person@example.com"), "unavailable");
  available = false;
  assert.equal(await checkLoginLimit("person@example.com"), "unavailable");
});

test("password sign-in blocks attempts before Auth, and allows valid login", async () => {
  let state = "limited", attempts = 0, authCalls = 0, credentials;
  const { signIn } = loadTs("src/app/login/actions.ts", {
    "next/headers": {},
    "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
    "@/lib/safe-next": loadTs("src/lib/safe-next.ts"),
    "@/lib/password-policy": loadTs("src/lib/password-policy.ts"),
    "@/lib/auth-redirect": { destinationAfterSignIn: async next => next },
    "@/lib/mock-auth": {},
    "@/lib/login-rate-limit": { checkLoginLimit: async email => {
      assert.equal(email, "person@example.com"); attempts++; return state;
    } },
    "@/lib/supabase-server": { createAuthClient: async () => {
      authCalls++;
      return { auth: { signInWithPassword: async value => { credentials = value; return { error: null }; } } };
    } },
  });
  const form = new FormData();
  form.set("email", " Person@Example.COM "); form.set("password", "test-password"); form.set("next", "/trips");
  await assert.rejects(signIn(form), e => decodeURIComponent(e.message).includes("15"));
  assert.equal(authCalls, 0);
  state = "unavailable";
  await assert.rejects(signIn(form), /redirect:\/login\?/);
  assert.equal(authCalls, 0);
  state = "allowed";
  await assert.rejects(signIn(form), /redirect:\/trips$/);
  assert.equal(authCalls, 1);
  assert.deepEqual(credentials, { email: "person@example.com", password: "test-password" });
  assert.equal(attempts, 3);
  form.set("email", "invalid");
  await assert.rejects(signIn(form), /redirect:\/login\?/);
  assert.equal(attempts, 3);
  assert.equal(authCalls, 1);
});
