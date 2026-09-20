import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const policy = loadTs("src/lib/password-policy.ts");
test("signup accepts long passphrases without forcing character classes", () => {
  assert.equal(policy.signupPasswordError("mango river copper cloud"), null);
  assert.equal(policy.signupPasswordError("V7!n4Q#s9L@x2Ry"), null);
  assert.equal(policy.signupPasswordError("V7!n4Q#s"), null);
  assert.notEqual(policy.signupPasswordError("Abc123!"), null);
  assert.notEqual(policy.signupPasswordError("a".repeat(20)), null);
  assert.notEqual(policy.signupPasswordError("passwordpassword!"), null);
  assert.notEqual(policy.signupPasswordError("ab".repeat(65)), null);
  assert.equal(policy.signupPasswordError("ab".repeat(64)), null);
  assert.equal(policy.passwordFeedback("😀").length, 1);
});
test("strength feedback distinguishes empty, short and longer passwords", () => {
  assert.equal(policy.passwordFeedback("").level, 0);
  assert.equal(policy.passwordFeedback("Ab1!").level, 1);
  const feedback = policy.passwordFeedback("V7!n4Q#s9L@x2Ry");
  assert.equal(feedback.level, 3);
  assert(feedback.lower && feedback.upper && feedback.digit && feedback.symbol);
});
test("signup server action rejects weak passwords before contacting Auth", async () => {
  let calls = 0;
  const { signUp } = loadTs("src/app/login/actions.ts", {
    "next/headers": { headers: async () => new Headers({ host: "localhost", "x-forwarded-proto": "http" }) },
    "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
    "@/lib/safe-next": loadTs("src/lib/safe-next.ts"),
    "@/lib/password-policy": policy,
    "@/lib/login-rate-limit": {}, "@/lib/auth-redirect": {}, "@/lib/mock-auth": {},
    "@/lib/supabase-server": { createAuthClient: async () => ({ auth: { signUp: async () => {
      calls++; return { data: { session: null }, error: null };
    } } }) },
  });
  const form = new FormData(); form.set("email", "person@example.com"); form.set("next", "/trips");
  for (const password of ["Abc123!", "a".repeat(20), "ab".repeat(65)]) {
    form.set("password", password);
    await assert.rejects(signUp(form), /redirect:\/login\?error=/);
    assert.equal(calls, 0);
  }
  form.set("password", "V7!n4Q#s");
  await assert.rejects(signUp(form), /redirect:\/login\?message=/);
  assert.equal(calls, 1);
});
