# Admin Team Management — Design Spec

**Date:** 2026-04-28  
**Status:** Approved  
**Scope:** Admin-only user management area for the internal dashboard portal

---

## Overview

A new "Equipe" section in the admin dashboard sidebar (visible only to ADMIN role) that allows admins to:
- View all internal users with their roles and status
- Create new users (system sends temporary password by email)
- Edit user name and role
- Deactivate users (soft delete — user cannot log in but record is preserved)
- Reactivate deactivated users
- Permanently delete deactivated users (hard delete)

Admins cannot modify or delete their own account.

---

## Routes

| Route | Description |
|-------|-------------|
| `/dashboard/team` | Main page — user list |
| `/api/dashboard/team` | GET (list users), POST (create user) |
| `/api/dashboard/team/[id]` | PATCH (update name/role/active), DELETE (permanent delete) |

---

## Sidebar Navigation

A new nav item is added to `components/dashboard/professional-sidebar.tsx`:

```
{ href: "/dashboard/team", label: "Equipe", icon: Users2, roles: ["ADMIN"] }
```

Positioned in the sidebar below the existing navigation items, within a section visible only to ADMIN.

---

## Page: /dashboard/team

### Layout

- Page header: title "Equipe", subtitle, "+ Novo Usuário" button
- Filter bar: text search (name/email), role filter dropdown, status filter dropdown
- Users table (client component for interactivity)
- Sheet (shadcn Sheet component) for create/edit — slides in from the right

### Table Columns

| Column | Content |
|--------|---------|
| Usuário | Avatar with initials (colored by role), full name, email |
| Role | Colored badge (ADMIN=yellow, SALES=blue, etc.) |
| Status | Green "● Ativo" or red "○ Inativo" badge |
| Criado em | Formatted date |
| Ações | Contextual buttons (see below) |

### Contextual Actions

| User state | Available actions |
|------------|-------------------|
| Active + not self | Editar, Desativar |
| Active + self | "— você mesmo —" (no actions) |
| Inactive | Reativar, Excluir |

### Sheet: Create User

Fields:
- **Nome completo** (required, text)
- **Email** (required, email format, must be unique)
- **Role** (required, select — all roles except ADMIN hidden first, ADMIN at bottom)

Submit button: "Criar & Enviar Convite"

On submit: creates user, generates temporary password, sends welcome email via Resend.

### Sheet: Edit User

Same form fields as create, pre-filled. Email is read-only (cannot change email). Submit: "Salvar Alterações".

---

## API: POST /api/dashboard/team

**Auth:** Session must have `role === ADMIN`

**Body:**
```json
{
  "name": "Ana Ferreira",
  "email": "ana@carreirausa.com",
  "role": "SALES"
}
```

**Logic:**
1. Validate admin session
2. Validate required fields and email format
3. Check email uniqueness in `User` table
4. Generate temporary password: `crypto.randomBytes(12).toString('base64url')`
5. Hash password via `authService.hashPassword(tempPassword)`
6. Create user in database with `active: true`
7. Send welcome email via Resend with temporary password and login URL
8. Return created user (without password hash)

**Errors:**
- `401` — not authenticated or not ADMIN
- `400` — missing fields or invalid email
- `409` — email already exists

---

## API: GET /api/dashboard/team

**Auth:** Session must have `role === ADMIN`

**Returns:** Array of users with id, name, email, role, active, createdAt (no password fields)

**Query params:** `search`, `role`, `status` (optional filters — applied server-side)

---

## API: PATCH /api/dashboard/team/[id]

**Auth:** Session must have `role === ADMIN`. Admin cannot patch their own id.

**Body (any combination):**
```json
{
  "name": "Ana Ferreira",
  "role": "FINANCE",
  "active": false
}
```

**Logic:**
- Rejects if `id === session.user.id`
- Only updates `name`, `role`, `active` — all other fields ignored
- Returns updated user

**Errors:**
- `401` — not authenticated or not ADMIN
- `403` — attempting to modify own account
- `404` — user not found

---

## API: DELETE /api/dashboard/team/[id]

**Auth:** Session must have `role === ADMIN`. Admin cannot delete their own id.

**Guard:** Only allows deletion if `user.active === false`. Active users must be deactivated first.

**Logic:** Hard deletes the user record from the database.

**Errors:**
- `401` — not authenticated or not ADMIN
- `403` — attempting to delete own account, or user is still active
- `404` — user not found

---

## Email: Welcome / Temporary Password

Sent via Resend on user creation.

**Subject:** `Bem-vindo ao Carreira U.S.A. Hub — Suas credenciais de acesso`

**Body includes:**
- User's name
- Login URL (`/auth/signin`)
- Temporary password (plaintext, one-time use)
- Note to change password after first login

---

## Security

- All API routes verify `role === ADMIN` from the NextAuth session
- Admins cannot modify or delete their own account (checked by comparing `id` to `session.user.id`)
- Passwords are hashed with bcrypt via existing `authService.hashPassword()`
- Temporary passwords are generated with `crypto.randomBytes(12).toString('base64url')` — 16 characters of entropy
- Delete is only permitted on inactive users, preventing accidental data loss
- No password data is ever returned from any API endpoint

---

## Components

| File | Type | Purpose |
|------|------|---------|
| `app/dashboard/team/page.tsx` | Server component | Fetches initial user list, renders layout |
| `app/dashboard/team/TeamClient.tsx` | Client component | Table, filters, sheet open/close state |
| `app/dashboard/team/UserSheet.tsx` | Client component | Create/edit form inside shadcn Sheet |
| `app/api/dashboard/team/route.ts` | API route | GET + POST handlers |
| `app/api/dashboard/team/[id]/route.ts` | API route | PATCH + DELETE handlers |

---

## Out of Scope

- Password reset by admin (users use the existing forgot-password flow)
- Bulk user import
- Audit log of who changed what role
- Two-factor authentication
