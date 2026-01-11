import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Se não autenticado, redirecionar para login
    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    // Verificar permissões baseado em role
    const userRole = token.role as UserRole;

    // Rotas do dashboard requerem autenticação
    if (path.startsWith("/dashboard")) {
      // Rotas específicas por role
      if (path.startsWith("/dashboard/leads") && userRole !== "ADMIN" && userRole !== "SDR" && userRole !== "SALES") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      if (path.startsWith("/dashboard/invoices") && userRole !== "ADMIN" && userRole !== "FINANCE") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      if (path.startsWith("/dashboard/conversations") && userRole !== "ADMIN" && userRole !== "SUPPORT" && userRole !== "SDR") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
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

