import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { authService } from "./services/auth.service";

import { UserRole } from "@prisma/client";

/**
 * NextAuth Configuration
 * 
 * Responsabilidade: Autenticação e RBAC (Role-Based Access Control)
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "development-secret-change-in-production",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing credentials");
          return null;
        }

        try {
          console.log("[AUTH] Attempting login for:", credentials.email);

          // Query otimizada - selecionar campos necessários
          // Note: password field selection wrapped in try-catch for backward compatibility
          // (password column may not exist on all database deployments)
          let user: any;

          try {
            user = await prisma.user.findUnique({
              where: { email: credentials.email },
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
            console.warn("[AUTH] Password field not available, retrying without it");
            user = await prisma.user.findUnique({
              where: { email: credentials.email },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
              },
            });
          }

          if (!user) {
            console.log("[AUTH] User not found:", credentials.email);
            return null;
          }

          if (!user.active) {
            console.log("[AUTH] User is not active:", credentials.email);
            return null;
          }

          // Check if user has a password set
          if (!user.password) {
            console.log("[AUTH] User has no password set:", credentials.email);
            return null;
          }

          // Verify password with bcrypt
          const passwordValid = await authService.verifyPassword(
            credentials.password,
            user.password
          );

          if (!passwordValid) {
            console.log("[AUTH] Invalid password for:", credentials.email);
            return null;
          }

          console.log("[AUTH] Login successful for:", credentials.email, "Role:", user.role);

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
      // Adicionar dados do usuário ao token apenas no primeiro login
      if (user) {
        console.log("[AUTH] JWT callback - Adding user to token:", user.email);
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Adicionar dados do token à sessão
      console.log("[AUTH] Session callback - Creating session for:", token.email);
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

