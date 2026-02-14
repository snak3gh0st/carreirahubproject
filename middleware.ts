import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

/**
 * Route-to-role mapping for dashboard pages.
 * Each entry defines which roles can access routes starting with that prefix.
 * Routes are checked in order; first match wins.
 * Routes not listed here are accessible to any authenticated user (e.g. /dashboard itself).
 */
const routeRoleMap: { prefix: string; roles: UserRole[] }[] = [
  // Admin-only
  { prefix: "/dashboard/settings", roles: ["ADMIN"] },
  { prefix: "/dashboard/webhooks", roles: ["ADMIN"] },
  { prefix: "/dashboard/workflows", roles: ["ADMIN"] },
  { prefix: "/dashboard/debug", roles: ["ADMIN"] },

  // Sales & Leads
  { prefix: "/dashboard/leads", roles: ["ADMIN", "OPERATIONAL", "SDR", "SALES"] },
  { prefix: "/dashboard/conversations", roles: ["ADMIN", "OPERATIONAL", "SUPPORT", "SDR"] },

  // Finance & Billing
  { prefix: "/dashboard/invoices", roles: ["ADMIN", "OPERATIONAL", "FINANCE", "COMMERCIAL", "SALES"] },
  { prefix: "/dashboard/payments", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
  { prefix: "/dashboard/contracts", roles: ["ADMIN", "OPERATIONAL", "FINANCE", "SALES", "COMMERCIAL"] },
  { prefix: "/dashboard/insights", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },

  // Integrations
  { prefix: "/dashboard/integrations", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },

  // Support
  { prefix: "/dashboard/support", roles: ["ADMIN", "OPERATIONAL", "SUPPORT"] },

  // Shared routes (all roles)
  { prefix: "/dashboard/customers", roles: ["ADMIN", "OPERATIONAL", "SALES", "SDR", "FINANCE", "SUPPORT", "COMMERCIAL"] },
  { prefix: "/dashboard/deals", roles: ["ADMIN", "OPERATIONAL", "SALES", "SDR", "FINANCE", "SUPPORT"] },
  { prefix: "/dashboard/analytics", roles: ["ADMIN", "OPERATIONAL", "FINANCE"] },
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Se nao autenticado, redirecionar para login
    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    const userRole = token.role as UserRole;

    // Check route-level RBAC for dashboard pages
    if (path.startsWith("/dashboard")) {
      for (const route of routeRoleMap) {
        if (path.startsWith(route.prefix)) {
          if (!route.roles.includes(userRole)) {
            console.log(`[MIDDLEWARE] Access denied: ${userRole} -> ${path}`);
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
          break; // First match wins
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};

