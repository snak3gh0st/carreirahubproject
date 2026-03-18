import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { UserRole } from "@prisma/client";

/**
 * Unified middleware for admin dashboard (NextAuth) and client hub (custom JWT).
 *
 * - /dashboard/* → NextAuth via getToken (existing RBAC)
 * - /hub/* → custom JWT verification via hub-auth
 * - /api/hub/* → same JWT + CSRF on POST/PUT
 */

// ── Admin route-to-role mapping (unchanged from original) ────

const routeRoleMap: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/dashboard/settings", roles: ["ADMIN"] },
  { prefix: "/dashboard/webhooks", roles: ["ADMIN"] },
  { prefix: "/dashboard/workflows", roles: ["ADMIN"] },
  { prefix: "/dashboard/debug", roles: ["ADMIN"] },
  { prefix: "/dashboard/leads", roles: ["ADMIN", "OPERATIONAL", "SDR", "SALES"] },
  { prefix: "/dashboard/conversations", roles: ["ADMIN", "OPERATIONAL", "SUPPORT", "SDR"] },
  { prefix: "/dashboard/invoices", roles: ["ADMIN", "OPERATIONAL", "FINANCE", "COMMERCIAL", "SALES"] },
  { prefix: "/dashboard/payments", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
  { prefix: "/dashboard/contracts", roles: ["ADMIN", "OPERATIONAL", "FINANCE", "SALES", "COMMERCIAL"] },
  { prefix: "/dashboard/insights", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
  { prefix: "/dashboard/integrations", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
  { prefix: "/dashboard/support", roles: ["ADMIN", "OPERATIONAL", "SUPPORT"] },
  { prefix: "/dashboard/forms", roles: ["ADMIN", "OPERATIONAL", "SALES"] },
  { prefix: "/dashboard/tests", roles: ["ADMIN", "OPERATIONAL", "SALES"] },
  { prefix: "/dashboard/customers", roles: ["ADMIN", "OPERATIONAL", "SALES", "SDR", "FINANCE", "SUPPORT", "COMMERCIAL"] },
  { prefix: "/dashboard/deals", roles: ["ADMIN", "OPERATIONAL", "SALES", "SDR", "FINANCE", "SUPPORT"] },
  { prefix: "/dashboard/analytics", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin dashboard: NextAuth via getToken ──────────────────
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/dashboard")) {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    const userRole = token.role as UserRole;

    if (pathname.startsWith("/dashboard")) {
      for (const route of routeRoleMap) {
        if (pathname.startsWith(route.prefix)) {
          if (!route.roles.includes(userRole)) {
            console.log(`[MIDDLEWARE] Access denied: ${userRole} -> ${pathname}`);
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
          break;
        }
      }
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
    "/api/dashboard/:path*",
    "/hub/:path*",
    "/api/hub/:path*",
  ],
};
