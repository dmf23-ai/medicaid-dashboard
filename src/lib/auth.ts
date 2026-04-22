import crypto from "node:crypto";

/**
 * Lightweight shared-password auth for the National Medicaid Intelligence
 * Dashboard. No user accounts — one shared password, stored in the
 * DASHBOARD_PASSWORD env var. Successful login mints a signed cookie that is
 * valid for SESSION_DAYS.
 *
 * Implementation notes:
 *  - HMAC-SHA256 over a small JSON payload ({ iat, exp }) using SESSION_SECRET
 *  - No external dependencies — uses Node's built-in crypto module
 *  - Cookie is httpOnly + Secure + SameSite=Lax so it survives normal browsing
 *    but is not exposed to client JavaScript
 */

export const SESSION_COOKIE = "dashboard_session";
export const SESSION_DAYS = 7;

const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not configured. Set it to a random 32+ character string in your environment.",
    );
  }
  return secret;
}

function getPassword(): string {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    throw new Error(
      "DASHBOARD_PASSWORD is not configured. Set it in your environment to enable login.",
    );
  }
  return password;
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(data: string): string {
  return base64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a plain-text password against the configured DASHBOARD_PASSWORD
 * using a constant-time comparison.
 */
export function verifyPassword(candidate: string): boolean {
  if (!candidate) return false;
  try {
    return timingSafeEqualStr(candidate, getPassword());
  } catch {
    return false;
  }
}

/**
 * Create a signed session token. The token encodes its own expiry, so the
 * proxy can reject tokens without any database lookup.
 */
export function createSessionToken(now: number = Date.now()): {
  token: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(now + SESSION_MS);
  const payload = base64url(
    JSON.stringify({ iat: Math.floor(now / 1000), exp: Math.floor(expiresAt.getTime() / 1000) }),
  );
  const signature = sign(payload);
  return { token: `${payload}.${signature}`, expiresAt };
}

/**
 * Validate a session token. Returns true only if the signature matches AND
 * the token has not expired.
 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = sign(payload);
  if (!timingSafeEqualStr(signature, expected)) return false;
  try {
    const { exp } = JSON.parse(base64urlDecode(payload).toString("utf-8")) as {
      exp: number;
    };
    if (typeof exp !== "number") return false;
    return Date.now() < exp * 1000;
  } catch {
    return false;
  }
}
