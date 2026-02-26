/**
 * JWT-based session management for app_session cookie.
 *
 * Cookie value is a signed HS256 JWT containing { sub: username }.
 * Secret is read from JWT_SECRET env var (required in production).
 *
 * Falls back to treating the raw value as a plain username when the
 * value is not a valid JWT – this keeps existing sessions working
 * during the migration period without forcing all users to re-login.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "app_session";
const ALGORITHM = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is not set");
    }
    // Dev fallback – predictable but harmless locally
    return new TextEncoder().encode("dev-only-insecure-secret-change-in-prod");
  }
  return new TextEncoder().encode(secret);
}

/** Create a signed JWT for the given username. */
export async function signSession(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Read and verify the app_session cookie.
 * Returns the username on success, null on failure / missing cookie.
 *
 * Accepts both:
 *   - New format: signed JWT  → verified & decoded
 *   - Legacy format: plain username string → returned as-is (migration window)
 */
export async function getSessionUsername(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw || !raw.trim()) return null;

    // JWT tokens always contain two dots (header.payload.signature)
    if (raw.split(".").length === 3) {
      const { payload } = await jwtVerify(raw, getSecret());
      const username = payload.sub;
      if (!username || typeof username !== "string") return null;
      return username;
    }

    // Legacy plain-text cookie – accepted during migration window only.
    // After this date all active 7-day sessions will have naturally expired
    // and this branch becomes unreachable — feel free to delete it.
    const MIGRATION_WINDOW_END = new Date("2026-03-02T00:00:00Z");
    if (new Date() < MIGRATION_WINDOW_END) {
      return decodeURIComponent(raw);
    }
    return null;
  } catch {
    return null;
  }
}

/** Cookie options shared between login and any future token-refresh logic. */
export function buildCookieOptions(isProduction: boolean) {
  return {
    name: COOKIE_NAME,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    ...(isProduction ? { domain: ".yumoyumo.com" } : {}),
  };
}
