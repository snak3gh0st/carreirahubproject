import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ACCESS_AUDIT_SERVICE = "ACCESS_AUDIT";

export const ACCESS_AUDIT_ACTIONS = {
  INTERNAL_LOGIN_SUCCESS: "INTERNAL_LOGIN_SUCCESS",
  INTERNAL_LOGIN_FAILED: "INTERNAL_LOGIN_FAILED",
  CLIENT_LOGIN_SUCCESS: "CLIENT_LOGIN_SUCCESS",
  CLIENT_LOGIN_FAILED: "CLIENT_LOGIN_FAILED",
  ENDPOINT_ACCESS: "ENDPOINT_ACCESS",
  ENDPOINT_DENIED: "ENDPOINT_DENIED",
} as const;

type AccessAuditAction =
  (typeof ACCESS_AUDIT_ACTIONS)[keyof typeof ACCESS_AUDIT_ACTIONS] | string;

type AccessAuditActorType = "internal" | "client" | "anonymous" | "system";
type AccessAuditOutcome = "success" | "failure" | "blocked";

export type AccessAuditMetadata = {
  actorType: AccessAuditActorType;
  userId?: string;
  clientUserId?: string;
  customerId?: string;
  email?: string;
  role?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  host?: string;
  source?: string;
  outcome?: AccessAuditOutcome;
  [key: string]: string | number | boolean | null | undefined;
};

export type CreateAccessAuditLogInput = {
  action: AccessAuditAction;
  actorType: AccessAuditActorType;
  outcome?: AccessAuditOutcome;
  userId?: string | null;
  clientUserId?: string | null;
  customerId?: string | null;
  email?: string | null;
  role?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  host?: string | null;
  source?: string | null;
  error?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

const SENSITIVE_QUERY_PARAMS = new Set([
  "access_token",
  "client_secret",
  "code",
  "password",
  "refresh_token",
  "reset_token",
  "resetToken",
  "secret",
  "state",
  "token",
]);

const SKIPPED_AUDIT_PREFIXES = [
  "/_next/",
  "/api/auth/session",
  "/api/cron/",
  "/api/health",
  "/api/internal/access-audit",
  "/api/webhooks/",
  "/favicon.ico",
];

const AUDITED_PREFIXES = [
  "/dashboard",
  "/api/dashboard",
  "/ops",
  "/api/ops",
  "/hub",
  "/api/hub",
];

function truncate(value: string | null | undefined, length: number) {
  if (!value) return undefined;
  return value.length > length ? value.slice(0, length) : value;
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as T;
}

function pathnameOf(path: string) {
  try {
    return new URL(path, "https://audit.local").pathname;
  } catch {
    return path.split("?")[0] || "/";
  }
}

export function sanitizeAuditPath(path: string | null | undefined) {
  if (!path) return "/";

  try {
    const url = new URL(path, "https://audit.local");
    for (const param of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(param)) {
        url.searchParams.delete(param);
      }
    }
    const query = url.searchParams.toString();
    return query ? `${url.pathname}?${query}` : url.pathname;
  } catch {
    return path.split("?")[0] || "/";
  }
}

export function isAuditablePath(path: string | null | undefined) {
  if (!path) return false;
  const pathname = pathnameOf(path);

  if (SKIPPED_AUDIT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return AUDITED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getAuditIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    forwarded ||
    undefined
  );
}

export function getAuditHost(headers: Headers) {
  return headers.get("x-forwarded-host") || headers.get("host") || undefined;
}

export function buildAccessAuditMetadata(
  input: CreateAccessAuditLogInput
): AccessAuditMetadata {
  return removeUndefined({
    ...(input.metadata || {}),
    actorType: input.actorType,
    userId: truncate(input.userId, 80),
    clientUserId: truncate(input.clientUserId, 80),
    customerId: truncate(input.customerId, 80),
    email: truncate(input.email, 180),
    role: truncate(input.role, 80),
    method: truncate(input.method?.toUpperCase(), 12),
    path: sanitizeAuditPath(input.path),
    statusCode: input.statusCode ?? undefined,
    ip: truncate(input.ip, 80),
    userAgent: truncate(input.userAgent, 240),
    host: truncate(input.host, 180),
    source: truncate(input.source, 80),
    outcome: input.outcome,
  });
}

export async function createAccessAuditLog(input: CreateAccessAuditLogInput) {
  const outcome = input.outcome || "success";
  const status = outcome === "success" ? "SUCCESS" : "ERROR";
  const metadata = buildAccessAuditMetadata({ ...input, outcome });

  try {
    await prisma.integrationLog.create({
      data: {
        service: ACCESS_AUDIT_SERVICE,
        action: input.action,
        status,
        error: truncate(input.error, 1000),
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  } catch (error) {
    console.warn(
      "[ACCESS_AUDIT] Failed to write audit log:",
      error instanceof Error ? error.message : String(error)
    );
  }
}
