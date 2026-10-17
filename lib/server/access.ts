/**
 * Site-wide password gate.
 *
 * The cookie holds a digest derived from the password rather than a plain
 * "logged in" flag, so it cannot be forged by anyone who does not know the
 * password. Everything here uses Web Crypto and no node: imports, because the
 * middleware that enforces the gate runs on the edge runtime.
 */

export const ACCESS_COOKIE = "newerpack_access";

/** Where the visitor was heading when the gate stopped them. */
export const RETURN_COOKIE = "newerpack_from";

/**
 * Override in the hosting environment to keep the password out of the repo.
 * The fallback exists so a fresh checkout works without configuration.
 */
const PASSWORD = process.env.SITE_PASSWORD ?? "Newerpack";

/** Bump to invalidate every existing session. */
const VERSION = "v1";

let cached: Promise<string> | null = null;

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a correctly authenticated visitor carries. */
export function accessToken(): Promise<string> {
  cached ??= sha256Hex(`newerpack:${VERSION}:${PASSWORD}`);
  return cached;
}

/** Length-independent comparison, so timing does not leak the password. */
export function passwordMatches(candidate: string): boolean {
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(PASSWORD);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function tokenMatches(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await accessToken();
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Only ever redirect to a path on this site. */
export function safeDestination(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/unlock")) return "/";
  return value;
}
