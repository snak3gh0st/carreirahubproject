# Multi-Hub Portal Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Portal Selector landing page and an Operational Hub skeleton (`/ops/*`) without changing existing Commercial, Financial, or Client hubs.

**Architecture:** The root page (`/`) becomes a public Portal Selector with 3 cards. Commercial/Financial continue using `/dashboard/*` with existing role-based filtering. A new `/ops/*` portal with its own login page, layout, and sidebar uses NextAuth for auth, restricted to OPERATIONAL and ADMIN roles.

**Tech Stack:** Next.js 14 App Router, NextAuth, Tailwind CSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-27-multi-hub-portal-architecture-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/page.tsx` | Replace redirect with Portal Selector page |
| Create | `components/portal-selector/portal-card.tsx` | Reusable card component for portal selector |
| Modify | `middleware.ts` | Add `/ops/*` route protection + config.matcher |
| Create | `app/ops/login/page.tsx` | Operational login page (calls NextAuth signIn) |
| Create | `app/ops/layout.tsx` | Ops layout with session check + sidebar |
| Create | `app/ops/page.tsx` | Ops dashboard home (placeholder) |
| Create | `components/ops/ops-sidebar.tsx` | Operational sidebar navigation |
| Create | `app/ops/customers/page.tsx` | Customer list (operational view, placeholder) |
| Create | `app/ops/customers/[id]/page.tsx` | Customer detail (operational view, placeholder) |

---

### Task 1: Portal Card Component

**Files:**
- Create: `components/portal-selector/portal-card.tsx`

- [ ] **Step 1: Create the PortalCard component**

```tsx
// components/portal-selector/portal-card.tsx
import Link from "next/link";

interface PortalCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export function PortalCard({ title, description, href, icon }: PortalCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-4 p-8 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-brand-tangerina/30 transition-all duration-300"
    >
      <div className="w-14 h-14 rounded-xl bg-brand-verde/10 flex items-center justify-center text-brand-verde group-hover:bg-brand-verde group-hover:text-white transition-colors duration-300">
        {icon}
      </div>
      <div className="text-center">
        <h2 className="text-lg font-display font-semibold text-brand-verde">
          {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <span className="px-5 py-2.5 rounded-xl bg-brand-tangerina text-white text-sm font-semibold group-hover:opacity-90 transition">
        Acessar
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Create the AccessDeniedBanner component**

```tsx
// components/portal-selector/access-denied-banner.tsx
export function AccessDeniedBanner() {
  return (
    <div className="mb-8 px-6 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 max-w-3xl w-full text-center">
      Voce nao tem acesso a este portal. Selecione o portal correto.
    </div>
  );
}
```

- [ ] **Step 3: Verify files created**

Run: `ls components/portal-selector/`
Expected: `portal-card.tsx` and `access-denied-banner.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/portal-selector/portal-card.tsx components/portal-selector/access-denied-banner.tsx
git commit -m "feat: add PortalCard and AccessDeniedBanner components"
```

---

### Task 2: Portal Selector Page (Root)

**Files:**
- Modify: `app/page.tsx` (replace entire content)

**Context:** Currently `app/page.tsx` checks session and redirects to `/dashboard` or `/auth/signin`. We replace it with the Portal Selector page — a server component that renders 3 cards.

- [ ] **Step 1: Replace `app/page.tsx` with Portal Selector**

```tsx
// app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { PortalCard } from "@/components/portal-selector/portal-card";
import { AccessDeniedBanner } from "@/components/portal-selector/access-denied-banner";
import { Users, DollarSign, ClipboardCheck } from "lucide-react";

export default async function PortalSelectorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = session ? (session.user as any).role : null;

  return (
    <div className="min-h-screen bg-brand-creme flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-12">
        <Logo className="w-16 h-16 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold text-brand-verde">
          Carreira <span className="text-brand-tangerina">U.S.A.</span>
        </h1>
        <p className="text-brand-verde/60 text-sm mt-2">
          Selecione seu portal
        </p>
      </div>

      {/* Access denied banner */}
      {searchParams?.error === "access_denied" && <AccessDeniedBanner />}

      {/* Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <PortalCard
          title="Hub Comercial"
          description="Vendas, leads e gestao de clientes"
          href={session ? "/dashboard" : "/auth/signin"}
          icon={<Users className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Financeiro"
          description="Invoices, pagamentos e acompanhamento"
          href={session ? "/dashboard" : "/auth/signin"}
          icon={<DollarSign className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Operacional"
          description="Onboarding, formularios e entregas"
          href={session && (userRole === "OPERATIONAL" || userRole === "ADMIN") ? "/ops" : "/ops/login"}
          icon={<ClipboardCheck className="h-7 w-7" />}
        />
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-brand-verde/30 mt-12">
        Powered by SIGMA INTEL
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify page renders at `/`**

Run: `npm run dev`
Navigate to: `http://localhost:3000/`
Expected: Portal Selector page with 3 cards, no redirect

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace root redirect with Portal Selector page"
```

---

### Task 3: Middleware — Add `/ops/*` Protection

**Files:**
- Modify: `middleware.ts`

**Context:** The middleware currently handles `/dashboard/*` (NextAuth) and `/hub/*` (custom JWT). We add a third section for `/ops/*` (NextAuth, roles OPERATIONAL + ADMIN). We also add `/ops/login` to public paths and update `config.matcher`.

- [ ] **Step 1: Add ops public paths and route handling to middleware**

Add `OPS_PUBLIC_PATHS` array after `HUB_PUBLIC_PATHS` (after line 45):

```typescript
// ── Ops public paths (no auth needed) ───────────────────────
const OPS_PUBLIC_PATHS = ["/ops/login"];
```

Add ops public path check right after the admin dashboard block (after line 73, before the hub public paths check):

```typescript
  // ── Ops public routes: no auth needed ──────────────────────
  if (OPS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Ops portal: NextAuth with OPERATIONAL/ADMIN role ───────
  if (pathname.startsWith("/ops") || pathname.startsWith("/api/ops")) {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.redirect(new URL("/ops/login", request.url));
    }

    const userRole = token.role as UserRole;
    if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
      console.log(`[MIDDLEWARE] Ops access denied: ${userRole} -> ${pathname}`);
      return NextResponse.redirect(new URL("/?error=access_denied", request.url));
    }

    return NextResponse.next();
  }
```

- [ ] **Step 2: Update `config.matcher` to include ops routes**

Replace the existing matcher (lines 108-115):

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
    "/hub/:path*",
    "/api/hub/:path*",
    "/ops/:path*",
    "/api/ops/:path*",
  ],
};
```

- [ ] **Step 3: Verify middleware compiles**

Run: `npm run dev`
Expected: no compilation errors

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: add /ops/* route protection to middleware"
```

---

### Task 4: Ops Login Page

**Files:**
- Create: `app/ops/login/page.tsx`

**Context:** This is a client component that calls NextAuth `signIn("credentials", ...)` — same pattern as `app/auth/signin/page.tsx` but with operational branding and redirect to `/ops` on success.

- [ ] **Step 1: Create the ops login page**

```tsx
// app/ops/login/page.tsx
"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Logo } from "@/components/brand/Logo";

export default function OpsLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect based on role
  useEffect(() => {
    if (status === "authenticated" && session) {
      const role = (session.user as any).role;
      if (role === "OPERATIONAL" || role === "ADMIN") {
        router.replace("/ops");
      } else {
        router.replace("/?error=access_denied");
      }
    }
  }, [session, status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-verde">
        <div className="text-white/60">Carregando...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/ops",
      });

      if (result?.error) {
        setError("Credenciais invalidas ou acesso nao autorizado.");
        setLoading(false);
      } else if (result?.ok) {
        window.location.href = "/ops";
      }
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
      <div className="max-w-sm w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-5" />
          <h1 className="font-display text-3xl font-bold text-white">
            Carreira <span className="text-brand-tangerina">U.S.A.</span>
          </h1>
          <p className="text-white/60 text-sm mt-2">Hub Operacional</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-7">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-verde mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-verde mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60 bg-brand-tangerina hover:opacity-90"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Powered by SIGMA INTEL
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page renders**

Navigate to: `http://localhost:3000/ops/login`
Expected: Login form with "Hub Operacional" subtitle, verde background

- [ ] **Step 3: Commit**

```bash
git add app/ops/login/page.tsx
git commit -m "feat: add ops login page with NextAuth signIn"
```

---

### Task 5: Ops Sidebar Component

**Files:**
- Create: `components/ops/ops-sidebar.tsx`

**Context:** Mirrors the pattern of `components/dashboard/professional-sidebar.tsx` but with operational navigation items only.

- [ ] **Step 1: Create the ops sidebar**

```tsx
// components/ops/ops-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  Users,
  LogOut,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/ops", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ops/customers", label: "Clientes", icon: Users },
];

interface OpsSidebarProps {
  userName?: string;
  userEmail?: string;
}

export function OpsSidebar({ userName = "User", userEmail = "" }: OpsSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/ops") return pathname === "/ops";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-brand-verde flex flex-col z-30">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <Link href="/ops" className="flex items-center gap-3">
          <Logo className="w-9 h-9" />
          <div>
            <span className="font-display text-base font-bold text-white leading-tight block">
              Carreira <span className="text-brand-tangerina">U.S.A.</span>
            </span>
            <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
              Operacional
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group ${
                active
                  ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                  : "text-white font-normal hover:bg-white/10"
              }`}
            >
              <Icon className={`h-5 w-5 transition-colors ${
                active ? "text-white" : "text-white/70 group-hover:text-white"
              }`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-brand-tangerina/20 flex items-center justify-center text-brand-tangerina text-xs font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{userName}</p>
            <p className="text-[10px] text-white/40 truncate">Operacional</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/ops/login" })}
            className="p-2 text-white/50 hover:text-brand-tangerina hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 px-3 py-2 text-center">
          <p className="text-[9px] text-white/20 tracking-wider uppercase">
            Powered by SIGMA INTEL
          </p>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls components/ops/ops-sidebar.tsx`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add components/ops/ops-sidebar.tsx
git commit -m "feat: add OpsSidebar component for operational portal"
```

---

### Task 6: Ops Layout

**Files:**
- Create: `app/ops/layout.tsx`

**Context:** Server component that checks session + role, then renders OpsSidebar + children. Mirrors `app/dashboard/layout.tsx` pattern but redirects to `/ops/login` and validates OPERATIONAL/ADMIN role.

- [ ] **Step 1: Create the ops layout**

```tsx
// app/ops/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OpsSidebar } from "@/components/ops/ops-sidebar";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[OpsLayout] Session error:", error);
    redirect("/ops/login");
  }

  if (!session) {
    redirect("/ops/login");
  }

  const userRole = (session.user as any).role;
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";

  // Double-check role at layout level (middleware also checks)
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    redirect("/");
  }

  return (
    <div data-portal="ops" className="min-h-screen bg-gray-50">
      <OpsSidebar userName={userName} userEmail={userEmail} />
      <main id="main-content" className="min-h-screen pl-60">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls app/ops/layout.tsx`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add app/ops/layout.tsx
git commit -m "feat: add ops layout with session verification"
```

---

### Task 7: Ops Dashboard Home Page

**Files:**
- Create: `app/ops/page.tsx`

**Context:** Simple placeholder page for the operational dashboard home. Will be expanded when operational workflow details arrive.

- [ ] **Step 1: Create the ops home page**

```tsx
// app/ops/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClipboardCheck } from "lucide-react";

export default async function OpsHomePage() {
  const session = await getServerSession(authOptions);
  const userName = (session?.user as any)?.name || "User";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Hub Operacional
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo, {userName}
        </p>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <ClipboardCheck className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          O Hub Operacional esta sendo configurado. As funcionalidades de
          onboarding, formularios e entregas serao adicionadas em breve.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/ops/page.tsx
git commit -m "feat: add ops dashboard home page (placeholder)"
```

---

### Task 8: Ops Customers Page (Placeholder)

**Files:**
- Create: `app/ops/customers/page.tsx`

**Context:** Placeholder for the operational customer list. Will show customers from an operational perspective when details arrive.

- [ ] **Step 1: Create the ops customers page**

```tsx
// app/ops/customers/page.tsx
import { Users } from "lucide-react";

export default function OpsCustomersPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Clientes
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visao operacional dos clientes
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <Users className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          A lista de clientes com visao operacional sera adicionada quando os
          detalhes do fluxo operacional forem definidos.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the ops customer detail page**

```tsx
// app/ops/customers/[id]/page.tsx
import { Users } from "lucide-react";

export default function OpsCustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Detalhe do Cliente
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visao operacional — deliverables e acompanhamento
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <Users className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          O detalhe operacional do cliente sera adicionado quando os
          detalhes do fluxo operacional forem definidos.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/ops/customers/page.tsx app/ops/customers/\[id\]/page.tsx
git commit -m "feat: add ops customers pages (placeholder)"
```

---

### Task 9: End-to-End Smoke Test

**Files:** None (testing only)

- [ ] **Step 1: Test Portal Selector (unauthenticated)**

Navigate to: `http://localhost:3000/`
Expected: 3 cards — Comercial, Financeiro, Operacional. No redirect.

- [ ] **Step 2: Test Commercial card (unauthenticated)**

Click "Hub Comercial" card
Expected: Redirects to `/auth/signin`

- [ ] **Step 3: Test Operational login page**

Click "Hub Operacional" card
Expected: Redirects to `/ops/login` with "Hub Operacional" subtitle

- [ ] **Step 4: Test ops login with OPERATIONAL user**

Login at `/ops/login` with an OPERATIONAL user
Expected: Redirects to `/ops`, shows ops sidebar with Dashboard + Clientes

- [ ] **Step 5: Test ops login with wrong role**

Login at `/ops/login` with a FINANCE user, then navigate to `/ops`
Expected: Middleware redirects to `/` (Portal Selector)

- [ ] **Step 6: Test dashboard still works**

Login as COMMERCIAL at `/auth/signin`
Expected: `/dashboard` works as before, sidebar shows commercial items only

- [ ] **Step 7: Test hub still works**

Navigate to `http://localhost:3000/hub/login`
Expected: Client hub login works as before, completely unaffected

- [ ] **Step 8: Final commit**

```bash
git commit --allow-empty -m "test: smoke test multi-hub portal architecture passed"
```
