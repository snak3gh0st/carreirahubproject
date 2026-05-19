import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HubJwtPayload {
  clientUserId: string;
  customerId: string;
  email: string;
  language: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = "hub-token";
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SLIDING_WINDOW_THRESHOLD = TTL_SECONDS / 2; // 50 % of TTL

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// JWT sign / verify
// ---------------------------------------------------------------------------

/**
 * Create a signed JWT containing the Hub payload.
 */
export async function signHubToken(payload: HubJwtPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
  return token;
}

/**
 * Verify a Hub JWT and return its payload, or `null` when invalid / expired.
 */
export async function verifyHubToken(
  token: string
): Promise<{ data: HubJwtPayload; iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const data: HubJwtPayload = {
      clientUserId: payload.clientUserId as string,
      customerId: payload.customerId as string,
      email: payload.email as string,
      language: payload.language as string,
    };
    return { data, iat: payload.iat as number };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Set the `hub-token` cookie on a `NextResponse`.
 */
export function setHubCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/**
 * Clear the `hub-token` cookie on a `NextResponse`.
 */
export function clearHubCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Extract the hub token string from the incoming request cookies.
 */
export function getHubTokenFromRequest(
  request: NextRequest
): string | undefined {
  return request.cookies.get(COOKIE_NAME)?.value;
}

/**
 * Middleware-oriented helper:
 *  1. Reads the JWT from the request cookie.
 *  2. Verifies it.
 *  3. Injects `x-hub-customer-id`, `x-hub-client-user-id`, and
 *     `x-hub-language` headers into the response.
 *  4. Performs a sliding-window refresh when more than 50 % of the TTL has
 *     elapsed since the token was issued.
 *
 * Returns `{ payload, response }` on success, or `null` if the token is
 * missing / invalid.
 */
export async function verifyHubRequest(
  request: NextRequest
): Promise<{ payload: HubJwtPayload; response: NextResponse } | null> {
  const token = getHubTokenFromRequest(request);
  if (!token) return null;

  const result = await verifyHubToken(token);
  if (!result) return null;

  const { data: payload, iat } = result;

  const response = NextResponse.next();
  response.headers.set("x-hub-customer-id", payload.customerId);
  response.headers.set("x-hub-client-user-id", payload.clientUserId);
  response.headers.set("x-hub-language", payload.language);

  // Sliding window refresh: re-sign only when >50 % TTL has passed
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - iat;
  if (elapsed > SLIDING_WINDOW_THRESHOLD) {
    const freshToken = await signHubToken(payload);
    setHubCookie(response, freshToken);
  }

  return { payload, response };
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

/**
 * Verify that the `Origin` header is trusted for state-changing Hub requests.
 * Production is strict. Local development can run on alternate loopback ports
 * when NEXTAUTH_URL is still configured for the default port.
 */
function parseOrigin(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normaliseOrigin(value: URL): string {
  return value.origin.replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isAllowedCsrfOrigin(
  origin: string | null | undefined,
  allowed: string | null | undefined,
  nodeEnv = process.env.NODE_ENV
): boolean {
  const parsedOrigin = parseOrigin(origin);
  const parsedAllowed = parseOrigin(allowed);
  if (!parsedOrigin || !parsedAllowed) return false;

  if (normaliseOrigin(parsedOrigin) === normaliseOrigin(parsedAllowed)) {
    return true;
  }

  if (nodeEnv === "production") return false;

  return (
    parsedOrigin.protocol === parsedAllowed.protocol &&
    isLoopbackHostname(parsedOrigin.hostname) &&
    isLoopbackHostname(parsedAllowed.hostname)
  );
}

export function verifyCsrf(request: NextRequest): boolean {
  return isAllowedCsrfOrigin(
    request.headers.get("origin"),
    process.env.NEXTAUTH_URL
  );
}

// ---------------------------------------------------------------------------
// Password utilities
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt (12 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate an 8-character temporary password using only unambiguous
 * alphanumeric characters (excludes 0, O, l, 1, I).
 */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

// ---------------------------------------------------------------------------
// High-level auth readers
// ---------------------------------------------------------------------------

/**
 * Read the hub token from a `NextRequest` and return the payload, or `null`.
 * Use this in API route handlers.
 */
export async function getHubAuth(
  request: NextRequest
): Promise<HubJwtPayload | null> {
  const token = getHubTokenFromRequest(request);
  if (!token) return null;

  const result = await verifyHubToken(token);
  return result?.data ?? null;
}

/**
 * Read the hub token from `cookies()` (next/headers) for use in React Server
 * Components and Server Actions.  Returns the payload, or `null`.
 */
export async function getHubSession(): Promise<HubJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await verifyHubToken(token);
  return result?.data ?? null;
}
