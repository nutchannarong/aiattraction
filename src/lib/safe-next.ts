/** Accept only local paths, including after URL normalization. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  // Reject encoded separators as well, so another decoding layer cannot change the host.
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25)/i.test(value.split(/[?#]/, 1)[0])) return fallback;
  try {
    const base = "https://redirect.invalid";
    const url = new URL(value, base);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return url.origin === base && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}
