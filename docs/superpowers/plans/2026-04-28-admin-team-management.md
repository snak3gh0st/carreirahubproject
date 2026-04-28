# Admin Team Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ADMIN-only "Equipe" section at `/dashboard/team` for creating, editing, deactivating, and permanently deleting internal users with role assignment and welcome-email flow.

**Architecture:** Server component at `/dashboard/team/page.tsx` fetches the user list and passes it to a client component (`TeamClient.tsx`) that handles table filtering and sheet state. A separate `UserSheet.tsx` drives the create/edit form. Two API routes handle all mutations, both guarded to `role === ADMIN`.

**Tech Stack:** Next.js App Router, NextAuth (session), Prisma, shadcn/ui (Sheet, Table, Badge, Button, Input, Select), Resend (email), bcryptjs (password hash via existing `authService`), Node.js `crypto` module.

---

## File Map

| Action | Path |
|--------|------|
| Create | `app/api/dashboard/team/route.ts` |
| Create | `app/api/dashboard/team/[id]/route.ts` |
| Modify | `lib/services/email.service.ts` — add `sendTeamMemberWelcome()` |
| Create | `app/dashboard/team/page.tsx` |
| Create | `app/dashboard/team/TeamClient.tsx` |
| Create | `app/dashboard/team/UserSheet.tsx` |
| Modify | `components/dashboard/professional-sidebar.tsx` — add Equipe nav item |

---

## Task 1: Add `sendTeamMemberWelcome` to email service

**Files:**
- Modify: `lib/services/email.service.ts`

Add a new public method after `sendWelcomeWithTempPassword` (around line 679). The `sendEmailSimple` private method accepts `EmailTemplate { to, subject, html }` and is already available.

- [ ] **Step 1: Add the method**

Open `lib/services/email.service.ts`. After the closing brace of `sendWelcomeWithTempPassword` (line ~679), add:

```typescript
  async sendTeamMemberWelcome(data: {
    name: string;
    email: string;
    tempPassword: string;
  }): Promise<boolean> {
    const firstName = data.name.split(' ')[0];
    const loginUrl = `${process.env.NEXTAUTH_URL || 'https://carreirausa.sigmaintel.io'}/auth/signin`;

    const bodyHtml = `
      <p>Olá, ${esc(firstName)}!</p>
      <p>Sua conta no Carreira U.S.A. Hub foi criada. Use as credenciais abaixo para acessar o painel interno.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">Suas credenciais</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>E-mail:</strong> ${esc(data.email)}</div>
        <div style="font-size:15px;"><strong>Senha temporária:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(data.tempPassword)}</span></div>
      </div>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Você será solicitado(a) a criar uma senha definitiva no primeiro acesso.</p>
    `;

    const html = renderBaseLayout({
      title: 'Bem-vindo(a) ao Carreira U.S.A.',
      preheader: 'Sua conta foi criada — acesse o painel interno',
      bodyHtml,
      ctaLabel: 'Acessar painel',
      ctaUrl: loginUrl,
    });

    return this.sendEmailSimple({
      to: data.email,
      subject: 'Bem-vindo(a) ao Carreira U.S.A. — Suas credenciais de acesso',
      html,
    });
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "email.service"
```

Expected: no output (no errors in email.service.ts).

- [ ] **Step 3: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "feat(email): add sendTeamMemberWelcome for internal user onboarding"
```

---

## Task 2: API route — GET + POST `/api/dashboard/team`

**Files:**
- Create: `app/api/dashboard/team/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/dashboard/team/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authService } from "@/lib/services/auth.service";
import { emailService } from "@/lib/services/email.service";
import { UserRole } from "@prisma/client";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }
    if (status === "active") where.active = true;
    if (status === "inactive") where.active = false;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[TEAM] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name?.trim() || !email?.trim() || !role) {
      return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (!Object.values(UserRole).includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const hashedPassword = await authService.hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), role: role as UserRole, password: hashedPassword, active: true },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    await emailService.sendTeamMemberWelcome({ name: user.name ?? name, email: user.email, tempPassword });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[TEAM] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "team"
```

Expected: no output.

- [ ] **Step 3: Manual smoke test — list users**

Start the dev server (`npm run dev`) and run:

```bash
# This will return 401 without a session — expected
curl -s http://localhost:3000/api/dashboard/team | jq .
```

Expected: `{"error":"Unauthorized"}`

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/team/route.ts
git commit -m "feat(api): add GET + POST /api/dashboard/team"
```

---

## Task 3: API route — PATCH + DELETE `/api/dashboard/team/[id]`

**Files:**
- Create: `app/api/dashboard/team/[id]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/dashboard/team/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = (session.user as any).id as string;
    if (params.id === adminId) {
      return NextResponse.json({ error: "Cannot modify your own account" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: { name?: string; role?: UserRole; active?: boolean } = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (!Object.values(UserRole).includes(body.role as UserRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updateData.role = body.role as UserRole;
    }
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[TEAM] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = (session.user as any).id as string;
    if (params.id === adminId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.active) {
      return NextResponse.json({ error: "Deactivate user before deleting" }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEAM] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "team"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/team/[id]/route.ts
git commit -m "feat(api): add PATCH + DELETE /api/dashboard/team/[id]"
```

---

## Task 4: `UserSheet` component — create/edit form

**Files:**
- Create: `app/dashboard/team/UserSheet.tsx`

This is a client component that renders a shadcn `Sheet` with a form. It handles both create mode (no `user` prop) and edit mode (`user` prop pre-fills the form).

- [ ] **Step 1: Create the file**

```typescript
// app/dashboard/team/UserSheet.tsx
"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_ROLES = ["SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL", "ADMIN"] as const;

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

interface UserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: TeamUser;
  onSuccess: () => void;
}

export function UserSheet({ open, onOpenChange, user, onSuccess }: UserSheetProps) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "SALES");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when sheet opens with a different user (or opens fresh)
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setRole(user?.role ?? "SALES");
      setError(null);
    }
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEdit ? `/api/dashboard/team/${user!.id}` : "/api/dashboard/team";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name, role }
        : { name, email, role };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar.");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Altere o nome ou o role do usuário."
              : "Uma senha temporária será enviada por email."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana Ferreira"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@carreirausa.com"
              required
              disabled={isEdit}
              className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">Email não pode ser alterado.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-brand-verde hover:bg-brand-verde/90" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar & Enviar Convite"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "usersheet\|team"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/team/UserSheet.tsx
git commit -m "feat(team): add UserSheet create/edit form component"
```

---

## Task 5: `TeamClient` component — table, filters, sheet orchestration

**Files:**
- Create: `app/dashboard/team/TeamClient.tsx`

- [ ] **Step 1: Create the file**

```typescript
// app/dashboard/team/TeamClient.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserSheet } from "./UserSheet";
import { UserPlus, Search } from "lucide-react";

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-yellow-100 text-yellow-800",
  SALES: "bg-blue-100 text-blue-800",
  SDR: "bg-purple-100 text-purple-800",
  FINANCE: "bg-green-100 text-green-800",
  SUPPORT: "bg-orange-100 text-orange-800",
  OPERATIONAL: "bg-gray-100 text-gray-800",
  COMMERCIAL: "bg-indigo-100 text-indigo-800",
};

const ALL_ROLES = ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL"];

export function TeamClient({ initialUsers, currentUserId }: { initialUsers: TeamUser[]; currentUserId: string }) {
  const [users, setUsers] = useState<TeamUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/dashboard/team?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }, [search, roleFilter, statusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === "active" && u.active) ||
        (statusFilter === "inactive" && !u.active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleDeactivate = async (user: TeamUser) => {
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: false } : u));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao desativar.");
    }
  };

  const handleReactivate = async (user: TeamUser) => {
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: true } : u));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao reativar.");
    }
  };

  const handleDelete = async (user: TeamUser) => {
    if (!confirm(`Excluir permanentemente ${user.name ?? user.email}? Esta ação não pode ser desfeita.`)) return;
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, { method: "DELETE" });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao excluir.");
    }
  };

  const openCreate = () => {
    setEditUser(undefined);
    setSheetOpen(true);
  };

  const openEdit = (user: TeamUser) => {
    setEditUser(user);
    setSheetOpen(true);
  };

  const getInitials = (name: string | null, email: string) => {
    if (!name) return email.slice(0, 2).toUpperCase();
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const avatarColor = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: "bg-yellow-600",
      SALES: "bg-blue-600",
      SDR: "bg-purple-600",
      FINANCE: "bg-green-600",
      SUPPORT: "bg-orange-600",
      OPERATIONAL: "bg-gray-600",
      COMMERCIAL: "bg-indigo-600",
    };
    return map[role] ?? "bg-gray-500";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie usuários e permissões de acesso</p>
        </div>
        <Button onClick={openCreate} className="bg-brand-verde hover:bg-brand-verde/90 text-white gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Todos os roles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{actionError}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criado em</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Nenhum usuário encontrado.</td>
              </tr>
            )}
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const isLoading = actionLoading === user.id;
              return (
                <tr key={user.id} className={`hover:bg-gray-50 ${!user.active ? "opacity-60" : ""}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(user.role)} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                        {getInitials(user.name, user.email)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{user.name ?? "—"}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 italic">— você mesmo —</span>
                      ) : user.active ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)} disabled={isLoading}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDeactivate(user)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : "Desativar"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleReactivate(user)} disabled={isLoading}>
                            {isLoading ? "..." : "Reativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : "Excluir"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editUser}
        onSuccess={refresh}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "teamclient\|team"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/team/TeamClient.tsx
git commit -m "feat(team): add TeamClient table with filters and sheet orchestration"
```

---

## Task 6: Server page `/dashboard/team/page.tsx`

**Files:**
- Create: `app/dashboard/team/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
// app/dashboard/team/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  const currentUserId = (session.user as any).id as string;

  return (
    <TeamClient
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={currentUserId}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "team"
```

Expected: no output.

- [ ] **Step 3: Open in browser**

With dev server running, log in as an ADMIN user and navigate to `http://localhost:3000/dashboard/team`.

Expected: page renders with the user table. Attempting to access as a non-ADMIN user should redirect to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/team/page.tsx
git commit -m "feat(team): add /dashboard/team server page with ADMIN guard"
```

---

## Task 7: Add "Equipe" to the sidebar

**Files:**
- Modify: `components/dashboard/professional-sidebar.tsx`

- [ ] **Step 1: Add the import and nav item**

In `components/dashboard/professional-sidebar.tsx`:

1. Add `Users2` to the lucide-react import line (around line 7):

```typescript
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  FileSignature,
  ClipboardList,
  BarChart3,
  TrendingUp,
  LogOut,
  HeadphonesIcon,
  GraduationCap,
  Sparkles,
  PieChart,
  Users2,
} from "lucide-react";
```

2. Add the nav item to `mainNavItems` array. Insert it after the `{ href: "/dashboard/bi", ... }` entry (around line 84), inside the "Intelligence" section or just before it — the item should be last and ADMIN-only. Place it just before the `sectionBefore: "Intelligence"` block so it groups with admin tools:

```typescript
  {
    href: "/dashboard/team",
    label: "Equipe",
    icon: Users2,
    roles: ["ADMIN"],
    sectionBefore: "Admin",
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "sidebar\|team"
```

Expected: no output.

- [ ] **Step 3: Visual check in browser**

Log in as ADMIN and verify "Equipe" appears in the sidebar under a section header "Admin". Log in as a non-ADMIN user and verify the item is absent.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/professional-sidebar.tsx
git commit -m "feat(sidebar): add Equipe nav item for ADMIN role"
```

---

## Task 8: End-to-end smoke test

No automated test infrastructure exists in this project. Verify manually:

- [ ] **Step 1: Create a user**

1. Log in as ADMIN, navigate to `/dashboard/team`
2. Click "Novo Usuário", fill in name, email (use a real or test email), role = SALES
3. Click "Criar & Enviar Convite"
4. Verify new row appears in the table with status "Ativo"
5. Verify welcome email arrived (check inbox or Resend dashboard)

- [ ] **Step 2: Edit the user**

1. Click "Editar" on the new user row
2. Change the role to FINANCE
3. Click "Salvar Alterações"
4. Verify the role badge updates in the table

- [ ] **Step 3: Deactivate and delete**

1. Click "Desativar" — row should become faded with "Inativo" badge
2. Click "Reativar" — row should restore to "Ativo"
3. Click "Desativar" again, then click "Excluir" and confirm
4. Verify the row disappears

- [ ] **Step 4: Self-protection check**

Verify that your own row shows "— você mesmo —" with no action buttons.

- [ ] **Step 5: Non-ADMIN access check**

In a separate browser/incognito, log in as a non-ADMIN user and navigate to `/dashboard/team`. Expected: redirect to `/dashboard`. The "Equipe" sidebar item should not be visible.

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| ADMIN-only page guard | Task 6 |
| ADMIN-only API guard | Tasks 2, 3 |
| List users with filters | Tasks 2, 5 |
| Create user with temp password | Task 2 |
| Send welcome email | Tasks 1, 2 |
| Edit name + role | Tasks 3, 4, 5 |
| Deactivate (soft delete) | Tasks 3, 5 |
| Reactivate | Tasks 3, 5 |
| Hard delete (inactive only) | Tasks 3, 5 |
| Admin cannot modify self | Tasks 3, 5 |
| "Equipe" in sidebar | Task 7 |
| Sheet lateral UX | Task 4, 5 |
| Role + status badges in table | Task 5 |
