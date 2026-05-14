import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { authService } from "./services/auth.service";
import {
  ACCESS_AUDIT_ACTIONS,
  createAccessAuditLog,
  getAuditHost,
  getAuditIp,
} from "@/lib/admin/access-audit";

import { UserRole } from "@prisma/client";

function getAuthorizeAuditRequest(req: unknown) {
  const request = req as { headers?: HeadersInit; method?: string } | undefined;
  const headers = new Headers(request?.headers);
  return {
    method: request?.method || "POST",
    path: "/api/auth/callback/credentials",
    ip: getAuditIp(headers),
    userAgent: headers.get("user-agent"),
    host: getAuditHost(headers),
  };
}

/**
 * NextAuth Configuration
 * 
 * Responsabilidade: Autenticação e RBAC (Role-Based Access Control)
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const auditRequest = getAuthorizeAuditRequest(req);
        if (!credentials?.email || !credentials?.password) {
          // removed debug log
          if (credentials?.email) {
            await createAccessAuditLog({
              action: ACCESS_AUDIT_ACTIONS.INTERNAL_LOGIN_FAILED,
              actorType: "internal",
              outcome: "failure",
              email: credentials.email.toLowerCase().trim(),
              ...auditRequest,
              source: "nextauth",
              error: "missing_credentials",
            });
          }
          return null;
        }

        try {
          const normalizedEmail = credentials.email.toLowerCase().trim();
          // Query otimizada - selecionar campos necessários
          // Note: password field selection wrapped in try-catch for backward compatibility
          // (password column may not exist on all database deployments)
          let user: any;

          try {
            user = await prisma.user.findUnique({
              where: { email: normalizedEmail },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                password: true,
              },
            });
          } catch (selectError) {
            // If password field doesn't exist, select without it
            user = await prisma.user.findUnique({
              where: { email: normalizedEmail },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
              },
            });
          }

          if (!user || !user.active || !user.password) {
            await createAccessAuditLog({
              action: ACCESS_AUDIT_ACTIONS.INTERNAL_LOGIN_FAILED,
              actorType: "internal",
              outcome: "failure",
              email: normalizedEmail,
              userId: user?.id,
              role: user?.role,
              ...auditRequest,
              source: "nextauth",
              error: !user ? "user_not_found" : !user.active ? "inactive_user" : "missing_password_hash",
            });
            return null;
          }

          const passwordValid = await authService.verifyPassword(
            credentials.password,
            user.password
          );

          if (!passwordValid) {
            await createAccessAuditLog({
              action: ACCESS_AUDIT_ACTIONS.INTERNAL_LOGIN_FAILED,
              actorType: "internal",
              outcome: "failure",
              email: user.email,
              userId: user.id,
              role: user.role,
              ...auditRequest,
              source: "nextauth",
              error: "invalid_password",
            });
            return null;
          }

          await createAccessAuditLog({
            action: ACCESS_AUDIT_ACTIONS.INTERNAL_LOGIN_SUCCESS,
            actorType: "internal",
            outcome: "success",
            email: user.email,
            userId: user.id,
            role: user.role,
            ...auditRequest,
            source: "nextauth",
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("[AUTH] Error during authorization:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
    updateAge: 24 * 60 * 60, // Atualizar token a cada 24 horas
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  debug: false,
};

/**
 * Verificar se usuário tem permissão baseado em role
 */
export function hasPermission(
  userRole: UserRole,
  requiredRoles: UserRole[]
): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Middleware helper para verificar permissões
 */
export function requireRole(requiredRoles: UserRole[]) {
  return (userRole: UserRole) => {
    if (!hasPermission(userRole, requiredRoles)) {
      throw new Error("Insufficient permissions");
    }
  };
}
