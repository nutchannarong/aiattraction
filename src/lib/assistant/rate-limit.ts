// Best-effort per-instance limit so one visitor can't run up the OpenRouter bill.
// Serverless instances don't share memory, so this slows abuse rather than stopping it;
// set a spending limit on the OpenRouter key as the real cap.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

/** True when this caller has made too many AI requests recently (all AI endpoints count). */
export function rateLimited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}
