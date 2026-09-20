# Security configuration

## Admin access

Run `node scripts/configure-admin.mjs <username>` locally to generate a unique random password,
salted scrypt hash, and session signing secret. This updates `.env.local` and prints the new password
once; store it in a password manager. Re-running rotates credentials and invalidates admin sessions.
The old embedded password and all legacy session cookies are rejected.

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` from `.env.local` in the
production host's secret settings before deploying. Never prefix these with `NEXT_PUBLIC_`.
No admin login is accepted if configuration is missing. Restart/redeploy after any rotation.

Admin login attempts share one database bucket for the configured account: 10 attempts per
15 minutes across instances, regardless of the submitted username or IP headers. A malicious
caller can exhaust that allowance and temporarily block login; restrict `/admin` at the edge
to a trusted network where practical. This is a single-admin setup; individual accounts and MFA
remain a future enhancement, not a feature supplied by this patch.

## User password login

New signups through the application require 8–128 Unicode code points and reject a small set
of obvious repeating/common patterns. The shared UI/server policy permits long passphrases;
uppercase, lowercase, numbers, and symbols are suggestions, not mandatory composition rules.
The live strength indicator is a basic estimate, not an entropy or breached-password check.
Existing passwords remain usable for login. The eight-character minimum is the application's
chosen policy, not a claim of NIST compliance.
Supabase Auth's password policy for direct API signups has not been changed by this UI update.

The application's email/password sign-in reserves one attempt before calling Supabase Auth.
Each normalized email (trimmed, lowercase) gets 10 attempts per 15-minute window, shared across
instances using the existing `admin_login_attempt` RPC. Keys are SHA-256 hashes with a separate
`user-login:` namespace; emails and passwords are not stored in the counter. Successful and failed
attempts both count; success does not reset it. Unknown accounts receive the same quota behavior.
Missing service credentials or a failed counter deny login rather than bypassing the limit.
As with any account-level limit, attackers can temporarily exhaust another account's allowance.

This guards the application's password login action. Supabase's public Auth endpoint is separately
reachable: [provider rate limits](https://supabase.com/docs/guides/auth/rate-limits) still apply there.
For stronger protection of direct Auth calls, configure [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
and integrate its token with login/signup; CAPTCHA has not been enabled by this change.
OAuth passwords remain protected by the identity provider. No new migration is required;
`20260920090000_admin_analytics.sql` supplies the existing counter and service-only grants.

## AI quotas

Apply `supabase/migrations/20260920010553_ai_security_quotas.sql` before deploying the app.
Both AI endpoints require a Supabase user verified by `getUser()`; anonymous sign-ins and local
demo cookies cannot use paid AI. Planning without AI remains available without signing in.
`SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) is needed server-side to reserve quota.

The database atomically enforces shared limits:

- 30 AI requests per user per 10-minute window.
- 100 AI requests per user per UTC day.
- 1,000 reserved upstream model calls for the whole application per UTC day.

Chat reserves five model calls (the maximum tool rounds plus final answer); route advice reserves
one. Failed, malformed, cancelled, or shorter requests are not refunded. Automatic SDK retries are
disabled. Change limits through a reviewed migration. Quota failures deny AI requests with 503;
exhausted quotas return 429. No memory fallback or caller-controlled IP buckets exist.

These are usage caps, not a currency budget: model prices and input size affect actual charges.
Set a monetary spending limit on the production OpenRouter key in the provider dashboard.

## Verification

AI requests are checked locally before model calls. Recognized credentials, secret formats,
internal-system requests, and common Thai/English prompt injections reject the entire request.
Checks include prior conversation, trip fields, place names, tool arguments/results and complete
model output. Dynamic trip data is sent as untrusted user data, never interpolated into the system
instruction. The fixed policy forbids disclosure or invention of internal configuration and secrets.
Responses are buffered per model round before delivery so split streaming chunks cannot bypass
the same content check. AI endpoint errors do not log provider payloads or expose raw exceptions.

These rules are defense in depth, not a guarantee against every injection. An unlabeled arbitrary
password, novel obfuscation or semantic attack may be undetectable. No general text filter can
reliably recognize every password; the UI warns users not to share credentials. Matching may
also reject benign questions about passwords. Model tools remain limited to travel lookups.
Regression tests use synthetic attacks and a mocked model; they verify local boundaries, not
the behavior of a live model or provider data-retention settings.

Run `node --test tests/*.test.mjs`, `npx tsc --noEmit`, and `npm run lint`.
`tests/ai-quota.sql` checks the database limits and role grants in a transaction that rolls back.
Run it with a privileged SQL connection after applying the migration; no paid AI requests are needed.

The security advisor also reports existing project settings outside these four fixes:
[leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
and `rls_auto_enable` has [public SECURITY DEFINER execution grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
that need a separate review of its event-trigger context. The new quota table intentionally has
RLS without browser policies: browser roles have no grants and only the server can access it.
