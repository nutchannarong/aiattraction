import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

test("redirects reject external, encoded and normalized authority paths", () => {
  const { safeNext } = loadTs("src/lib/safe-next.ts");
  for (const input of [null, {}, "https://evil.test", "//evil.test", "/\\evil.test", "/\t/evil.test",
    "/%5cevil.test", "/%2fevil.test", "/%255cevil.test", "/%0a/evil.test", "/a/..//evil.test", "/%2e//evil.test"]) {
    assert.equal(safeNext(input), "/", String(input));
  }
  for (const input of ["/plan", "/trips?q=hello%20world#saved", "/profile?next=%2Fplan%3Fnew%3D1"]) {
    assert.equal(safeNext(input), input);
    assert.equal(new URL(safeNext(input), "https://app.test").origin, "https://app.test");
  }
  assert.equal(safeNext(null, ""), "");
});

test("AI authorization rejects guests, anonymous accounts and quota failures", async () => {
  let user = null, allowed = true, quotaError = null, dbAvailable = true, calls = [];
  const mocks = {
    "@/lib/supabase-server": { createAuthClient: async () => ({ auth: {
      getUser: async () => ({ data: { user }, error: null }),
    } }) },
    "@/lib/admin/database": { adminDatabase: () => dbAvailable ? {
      rpc: async (name, args) => { calls.push({ name, args }); return { data: allowed, error: quotaError }; },
    } : null },
  };
  const { authorizeAi } = loadTs("src/lib/assistant/rate-limit.ts", mocks);
  assert.equal((await authorizeAi(5)).status, 401);
  user = { id: "anonymous", is_anonymous: true };
  assert.equal((await authorizeAi(5)).status, 401);
  assert.equal(calls.length, 0);
  user = { id: "verified-user", is_anonymous: false };
  assert.equal(await authorizeAi(5), null);
  assert.deepEqual(calls[0], { name: "consume_ai_quota", args: { p_user: "verified-user", p_model_calls: 5 } });
  // A new server module still consults the same database, not a local counter.
  allowed = false;
  assert.equal((await loadTs("src/lib/assistant/rate-limit.ts", mocks).authorizeAi(1)).status, 429);
  for (const value of [null, undefined, "true"]) {
    allowed = value;
    assert.equal((await authorizeAi(1)).status, 503);
  }
  allowed = true; quotaError = { message: "offline" };
  assert.equal((await authorizeAi(1)).status, 503);
  dbAvailable = false;
  assert.equal((await authorizeAi(1)).status, 503);
});

test("AI endpoints reject requests before invoking the model when authorization fails", async () => {
  for (const [file, cost] of [["assistant", 5], ["route-advice", 1]]) {
    let deniedStatus = 401;
    const mocks = {
      "@/lib/ai": { isAiConfigured: () => true, getAi: () => { throw new Error("Paid call must not run"); } },
      "@/lib/assistant/safety": loadTs("src/lib/assistant/safety.ts"),
      "@/lib/assistant/rate-limit": { authorizeAi: async units => { assert.equal(units, cost); return new Response(null, { status: deniedStatus }); } },
      "@/app/plan/editor-actions": {}, "@/lib/geo": {}, "@/lib/place-groups": {},
      "@/lib/places": {}, "@/lib/planner/nearby": { NEARBY_CATEGORIES: [] }, "@/lib/weather": {},
    };
    const { POST } = loadTs(`src/app/api/${file}/route.ts`, mocks);
    for (const status of [401, 429, 503]) {
      deniedStatus = status;
      assert.equal((await POST(new Request("https://app.test/api", { method: "POST" }))).status, status);
    }
  }
});

test("admin limiter cannot be bypassed by changing supplied usernames or headers", async () => {
  const previous = process.env.ADMIN_USERNAME;
  process.env.ADMIN_USERNAME = "configured-owner";
  const keys = [];
  let checks = 0, allow = true, created = false;
  try {
    const { adminLogin } = loadTs("src/app/admin/login/actions.ts", {
      "next/navigation": { redirect: () => { throw new Error("redirect"); } },
      "@/lib/admin/session": {
        sessionConfigured: () => true, checkAdminPassword: async () => { checks++; return false; },
        createAdminSession: async () => { created = true; },
      },
      "@/lib/admin/database": { adminDatabase: () => ({ rpc: async (_name, args) => {
        keys.push(args.p_key); return { data: allow, error: null };
      } }) },
    });
    for (const username of ["configured-owner", "different-user", "random-user"]) {
      const form = new FormData(); form.set("username", username); form.set("password", "wrong-password-value");
      form.set("x-forwarded-for", crypto.randomUUID());
      await adminLogin("", form);
    }
    assert.equal(new Set(keys).size, 1);
    allow = false;
    await adminLogin("", new FormData());
    assert.equal(checks, 3);
    assert.equal(created, false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = previous;
  }
});
