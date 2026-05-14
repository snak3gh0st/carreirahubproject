import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { UserRole } from "@prisma/client";
import { buildSafeCallbackUrl } from "@/lib/hub-links";
import { isOperationalAccessRole } from "@/lib/roles";

/**
 * Unified middleware for admin dashboard (NextAuth) and client hub (custom JWT).
 *
 * - /dashboard/* → NextAuth via getToken (existing RBAC)
 * - /hub/* → custom JWT verification via hub-auth
 * - /api/hub/* → same JWT + CSRF on POST/PUT
 */

// ── Admin route-to-role mapping (unchanged from original) ────

const routeRoleMap: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/dashboard/executive", roles: ["ADMIN", "EXECUTIVE"] },
  { prefix: "/dashboard/commercial/leads", roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/settings", roles: ["ADMIN"] },
  { prefix: "/dashboard/webhooks", roles: ["ADMIN"] },
  { prefix: "/dashboard/workflows", roles: ["ADMIN"] },
  { prefix: "/dashboard/debug", roles: ["ADMIN"] },
  { prefix: "/dashboard/leads", roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/conversations", roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/invoices", roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/payments", roles: ["ADMIN", "FINANCE"] },
  { prefix: "/dashboard/contracts", roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/insights", roles: ["ADMIN", "FINANCE", "EXECUTIVE"] },
  { prefix: "/dashboard/integrations", roles: ["ADMIN", "FINANCE"] },
  { prefix: "/dashboard/support", roles: ["ADMIN", "COMMERCIAL"] },
  { prefix: "/dashboard/forms", roles: ["ADMIN", "COMMERCIAL", "OPERATIONAL", "HEAD_OPERACIONAL"] },
  { prefix: "/dashboard/tests", roles: ["ADMIN", "COMMERCIAL"] },
  { prefix: "/dashboard/customers", roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/deals", roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"] },
  { prefix: "/dashboard/analytics", roles: ["ADMIN", "FINANCE"] },
  { prefix: "/dashboard/financial", roles: ["ADMIN", "FINANCE", "COMMERCIAL", "EXECUTIVE"] },
  // D-09: new entry — Phase 20 verifier flagged the missing routeRoleMap row
  // for /dashboard/commercial-bi (handler-side gate only). EXECUTIVE added per
  // D-09; HEAD_COMERCIAL preserves existing access.
  { prefix: "/dashboard/commercial-bi", roles: ["ADMIN", "HEAD_COMERCIAL", "EXECUTIVE"] },
  // D-09 extension: /dashboard/bi is the legacy executive BI (ExecutiveHero,
  // RiskMap, DecisionQueue). Phase 20 verifier flagged the missing routeRoleMap
  // entry; Phase 20.1 wires it for ADMIN + EXECUTIVE so it can be the
  // deep-dive target from the Phase 20 EXECUTIVE briefing landing.
  { prefix: "/dashboard/bi", roles: ["ADMIN", "EXECUTIVE"] },
];

// ── Hub public paths (no auth needed) ────────────────────────

const HUB_PUBLIC_PATHS = [
  "/hub/login",
  "/hub/reset-password",
  "/hub/set-password",
  "/api/hub/auth/login",
  "/api/hub/auth/logout",
  "/api/hub/auth/reset-password",
  "/api/hub/auth/set-password",
];

// ── Ops public paths (no auth needed) ───────────────────────
const OPS_PUBLIC_PATHS = ["/ops/login"];

// ── EXECUTIVE write-block allowlists (D-12 LITERAL — user re-ratified) ──
//
// Defense-in-depth layer 1: EXECUTIVE is read-only. Any non-GET to /api/**
// is blocked at the perimeter EXCEPT:
//   1. Prefix-allowlisted portals/system routes (separate auth or no auth):
//      - /api/auth/      (NextAuth — sign-in must stay reachable)
//      - /api/hub/       (Client portal: ClientUser + custom JWT; EXECUTIVE NextAuth token doesn't authenticate here anyway)
//      - /api/ops/       (Ops portal: separate operational guard; EXECUTIVE can't reach anyway)
//      - /api/webhooks/  (external webhooks — no session at all)
//   2. Exact-match POST allowlist for the CEO Brief persona conversation:
//      - POST /api/dashboard/ai/chat
//      - POST /api/dashboard/ai/conversations
//      (DELETE on /api/dashboard/ai/conversations and DELETE on /api/dashboard/ai/messages/[id] are NOT allowlisted.)
const EXECUTIVE_API_ALLOWLIST = [
  "/api/auth/",
  "/api/hub/",
  "/api/ops/",
  "/api/webhooks/",
];

const EXECUTIVE_POST_CHAT_ALLOWLIST = [
  "/api/dashboard/ai/chat",
  "/api/dashboard/ai/conversations",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── EXECUTIVE write-block (D-12 LITERAL /api/* — layer 1) ───
  // Runs BEFORE branch dispatch so it covers root-level /api/* (leads,
  // customers, invoices/*, deals/*, contracts/*) that the dashboard branch
  // would otherwise miss. Token read is gated by method check so only
  // non-GET requests pay the JWT verification cost.
  if (
    pathname.startsWith("/api/") &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    const apiToken = await getToken({ req: request });
    if (apiToken?.role === "EXECUTIVE") {
      const isPrefixAllowed = EXECUTIVE_API_ALLOWLIST.some((prefix) =>
        pathname.startsWith(prefix)
      );
      const isChatAllowed =
        request.method === "POST" &&
        EXECUTIVE_POST_CHAT_ALLOWLIST.some(
          (p) => pathname === p || pathname === p + "/"
        );
      if (!isPrefixAllowed && !isChatAllowed) {
        console.log(
          `[MIDDLEWARE] EXECUTIVE write blocked: ${request.method} ${pathname}`
        );
        return NextResponse.json(
          { error: "forbidden", reason: "role_not_permitted" },
          { status: 403 }
        );
      }
    }
  }

  // ── Admin dashboard: NextAuth via getToken ──────────────────
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/dashboard")) {
    const token = await getToken({ req: request });

    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url);
      if (pathname.startsWith("/dashboard")) {
        signInUrl.searchParams.set(
          "callbackUrl",
          buildSafeCallbackUrl(`${pathname}${request.nextUrl.search}`)
        );
      }
      return NextResponse.redirect(signInUrl);
    }

    const userRole = token.role as UserRole;

    if (pathname.startsWith("/dashboard")) {
      for (const route of routeRoleMap) {
        if (pathname.startsWith(route.prefix)) {
          if (!route.roles.includes(userRole)) {
            console.log(`[MIDDLEWARE] Access denied: ${userRole} -> ${pathname}`);
            // D-13: UI routes redirect (not 403). EXECUTIVE lands on their own hub
            // (which they can read) instead of /dashboard (which they cannot).
            // ?error=role_not_permitted is the hook for a future toast component.
            const redirectUrl = userRole === "EXECUTIVE"
              ? "/dashboard/executive?error=role_not_permitted"
              : "/dashboard?error=role_not_permitted";
            return NextResponse.redirect(new URL(redirectUrl, request.url));
          }
          break;
        }
      }
    }

    return NextResponse.next();
  }

  // ── Ops public routes: no auth needed ──────────────────────
  if (OPS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Ops portal: NextAuth with operational access roles ─────
  if (pathname.startsWith("/ops") || pathname.startsWith("/api/ops")) {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.redirect(new URL("/ops/login", request.url));
    }

    const userRole = token.role as UserRole;
    if (!isOperationalAccessRole(userRole)) {
      console.log(`[MIDDLEWARE] Ops access denied: ${userRole} -> ${pathname}`);
      return NextResponse.redirect(new URL("/?error=access_denied", request.url));
    }

    return NextResponse.next();
  }

  // ── Hub public routes: no auth needed ───────────────────────
  if (HUB_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Hub protected routes: custom JWT ────────────────────────
  if (pathname.startsWith("/hub") || pathname.startsWith("/api/hub")) {
    // Dynamically import to keep hub-auth out of admin middleware path
    const { verifyHubRequest, verifyCsrf } = await import("@/lib/hub-auth");

    // CSRF check for state-mutating API requests
    if (pathname.startsWith("/api/hub") && ["POST", "PUT", "DELETE"].includes(request.method)) {
      // Skip CSRF for login and reset-password (pre-auth endpoints)
      const skipCsrf = pathname.includes("/auth/login") || pathname.includes("/auth/reset-password");
      if (!skipCsrf && !verifyCsrf(request)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await verifyHubRequest(request);
    if (!result) {
      if (pathname.startsWith("/api/hub")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/hub/login", request.url));
    }

    return result.response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/hub/:path*",
    "/ops/:path*",
  ],
};
