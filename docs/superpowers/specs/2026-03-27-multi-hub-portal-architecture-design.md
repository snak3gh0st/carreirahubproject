# Multi-Hub Portal Architecture Design

**Date:** 2026-03-27
**Status:** Approved
**Author:** Claude + Paulo

## Overview

Reorganize the Carreira AI Hub into 4 distinct portals with a unified entry page for the internal team. The existing Commercial and Financial hubs (both served by `/dashboard/*` with role-based filtering) remain untouched. A new Operational Hub (`/ops/*`) is added as a separate portal. A Portal Selector page replaces the current root redirect.

## Portal Architecture

| Portal | Route | Auth | Roles | Status |
|--------|-------|------|-------|--------|
| Hub Comercial | `/dashboard/*` | NextAuth | ADMIN, SALES, SDR, COMMERCIAL | Exists — no changes |
| Hub Financeiro | `/dashboard/*` | NextAuth | ADMIN, FINANCE | Exists — no changes |
| Hub Operacional | `/ops/*` | NextAuth | ADMIN, OPERATIONAL | New — skeleton now, features later |
| Hub Cliente | `/hub/*` | Custom JWT | ClientUser | Exists — no changes |

## Key Decisions

1. **Approach A selected** — Portal Selector + Login Contextual. Minimal changes, zero risk to existing features.
2. **Commercial and Financial stay in `/dashboard/*`** — They already work with role-based sidebar filtering and data isolation. No need to separate.
3. **Operational Hub is a new independent portal** at `/ops/*` — Same NextAuth auth, same `User` table, but dedicated routes, layout, and sidebar.
4. **Login is separated per portal** — Commercial/Financial share `/auth/signin`, Operational has `/ops/login`.
5. **Client Hub is completely separate** — Not part of the internal portal selector. Lives at `clientscarreira.sigmaintel.io`.
6. **Operational details TBD** — The specific operational workflow features will be defined later. This design covers the skeleton/structure only.
7. **OPERATIONAL role keeps `/dashboard/*` access** — OPERATIONAL users currently have broad dashboard access (leads, conversations, deals, invoices, contracts, customers, forms, tests, insights, integrations, support). This access is preserved. The Portal Selector shows the Operational Hub card, but OPERATIONAL users can still navigate to `/dashboard/*` if needed. The Ops Hub is their primary workspace; the dashboard is a fallback.
8. **`/ops/login` is a UI-only separation** — It is a dedicated login page with operational branding, but calls NextAuth `signIn("credentials", ...)` under the hood. No separate auth mechanism. No custom `/api/ops/auth/*` routes needed.

## Component 1: Portal Selector Page

**Route:** `app.carreirausa.com/` (replaces current redirect to `/dashboard`)

**Type:** Public page, no auth required.

**Layout:**
- Carreira USA logo centered at top
- Title: "Selecione seu portal"
- 3 cards side by side (responsive: stack on mobile)
- Brand colors: creme background (#F5E9DF), verde icons (#1B6B48), tangerina buttons (#EA580C)
- Fonts: Blaak for title, Neue Montreal for body

**Cards:**

| Card | Name | Description | Destination |
|------|------|-------------|-------------|
| 1 | Hub Comercial | Vendas, leads e gestao de clientes | `/auth/signin` |
| 2 | Hub Financeiro | Invoices, pagamentos e acompanhamento | `/auth/signin` |
| 3 | Hub Operacional | Onboarding, formularios e entregas | `/ops/login` |

**Behavior (Server Component with session check):**
- `app/page.tsx` is a Server Component that checks `getServerSession()` on load
- If session exists with matching role → card shows "Acessar" that goes directly to the portal
- If session exists with OPERATIONAL role and user clicks "Hub Operacional" → redirect to `/ops`
- If not logged in → card links to `/auth/signin` (Commercial/Financial) or `/ops/login` (Operational)
- If a user clicks a portal they don't have access to → middleware denies and redirects to `/` (Portal Selector) with a toast/message
- Client Hub is accessed directly via `clientscarreira.sigmaintel.io` — not shown on this page

## Component 2: Login (Commercial/Financial)

**No changes to the existing login flow.** The `/auth/signin` page continues to work as-is. After login, the middleware validates the user's role and allows/denies access to `/dashboard/*` routes. The sidebar already filters navigation items by role.

**Existing security layers (unchanged):**
1. Middleware RBAC — blocks routes by role
2. Query filtering — COMMERCIAL sees only `ownerId = userId`, FINANCE sees all

## Component 3: Hub Operacional

### Routes

```
app/
  ops/
    login/page.tsx            — Login page (public, calls NextAuth signIn())
    layout.tsx                — Layout with operational sidebar + session check
    page.tsx                  — Operational dashboard (home)
    customers/page.tsx        — Customer list (operational view)
    customers/[id]/page.tsx   — Customer detail (deliverables)
```

No custom `/api/ops/auth/*` routes needed — NextAuth's `/api/auth/[...nextauth]` handles all auth.

### Auth

- Same NextAuth strategy, same `User` table, same `/api/auth/[...nextauth]` endpoint
- `/ops/login` is a UI page that calls `signIn("credentials", { ... })` from `next-auth/react`
- After NextAuth login, middleware checks role is OPERATIONAL or ADMIN for `/ops/*` routes
- Cookie: same `next-auth.session-token` (NextAuth manages)
- If role doesn't match → redirect to `/` (Portal Selector)

### Layout

- Dedicated sidebar component (`components/ops/ops-sidebar.tsx`)
- Same branding as dashboard (verde/tangerina/creme)
- Initial menu: Dashboard, Clientes
- Additional menu items added when operational workflow details are defined

### Layout Session Verification

`app/ops/layout.tsx` mirrors the pattern in `app/dashboard/layout.tsx`:
1. Call `getServerSession()` to get the current session
2. If no session → redirect to `/ops/login`
3. If session exists but role is not OPERATIONAL or ADMIN → redirect to `/` (Portal Selector)
4. Pass user info to `OpsSidebar` component

### Middleware Addition

Add to the existing route-role map in `middleware.ts`:

```typescript
{ prefix: "/ops", roles: ["ADMIN", "OPERATIONAL"] }
```

Also update the `config.matcher` array to include:
```typescript
"/ops/:path*",
"/api/ops/:path*"
```

Public routes exception: add `/ops/login` to middleware bypass (similar to `HUB_PUBLIC_PATHS` pattern). Redirect denied users to `/` (Portal Selector).

## Component 4: New File Structure

```
app/
  page.tsx                      — Portal Selector (new, replaces redirect)
  ops/
    login/page.tsx              — Operational login UI (new, calls NextAuth signIn())
    layout.tsx                  — Operational layout + session check (new)
    page.tsx                    — Operational home (new)
    customers/page.tsx          — Customer list (new)
    customers/[id]/page.tsx     — Customer detail (new)
components/
  ops/
    ops-sidebar.tsx             — Operational sidebar (new)
  portal-selector/
    portal-card.tsx             — Reusable card for portal selector (new)
middleware.ts                   — Update: add /ops/* to routeRoleMap + config.matcher
```

## User Flows

### Internal Team (entry at app.carreirausa.com)

```
app.carreirausa.com/
  ├── [Hub Comercial] → /auth/signin → /dashboard (commercial sidebar)
  ├── [Hub Financeiro] → /auth/signin → /dashboard (financial sidebar)
  └── [Hub Operacional] → /ops/login → /ops (operational sidebar)
```

### Client (entry at clientscarreira.sigmaintel.io)

```
clientscarreira.sigmaintel.io/
  └── /hub/login → /hub (client portal)
```

## What Does NOT Change

- `/dashboard/*` routes, pages, components, APIs
- `/hub/*` routes, pages, components, APIs
- NextAuth configuration (`lib/auth.ts`)
- Hub auth configuration (`lib/hub-auth.ts`)
- All existing services in `lib/services/`
- Database schema (`prisma/schema.prisma`)
- All webhook and cron endpoints

## Smoke Test Checklist

After implementation, verify:
- [ ] Portal Selector renders at `/` with 3 cards
- [ ] Clicking "Hub Comercial" → `/auth/signin` → login → `/dashboard` (sidebar shows commercial items)
- [ ] Clicking "Hub Financeiro" → `/auth/signin` → login → `/dashboard` (sidebar shows financial items)
- [ ] Clicking "Hub Operacional" → `/ops/login` → login → `/ops` (operational dashboard)
- [ ] `/ops/login` with wrong role (e.g., FINANCE) → denied, redirect to `/`
- [ ] `/ops/*` without session → redirect to `/ops/login`
- [ ] OPERATIONAL user can still access `/dashboard/*` (backward compatible)
- [ ] Client Hub at `/hub/*` unaffected

## Future Work (When Operational Details Arrive)

- Specific operational pages inside `/ops/*`
- Operational APIs in `/api/ops/*`
- Deliverable tracking, checklists, SLA monitoring
- Form/test management from operational perspective
- Customer onboarding workflow views
