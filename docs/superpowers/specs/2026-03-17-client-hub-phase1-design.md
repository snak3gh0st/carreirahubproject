# Client Hub — Phase 1: Auth + Dashboard + Invoices/Payment

**Date**: 2026-03-17
**Status**: Approved
**Scope**: Phase 1 of 4

---

## Overview

Build a customer-facing portal ("Client Hub") for Carreira U.S.A. where clients can log in, view their invoices, and pay — with forced card saving via QB Payments API. This replaces the current isolated payment links with a unified customer experience.

The hub is the **interface layer only**. QuickBooks remains the financial engine for all invoice creation, payment processing, card storage, and accounting.

## Goals

- Give clients a single place to see and pay their invoices
- Force card saving on first payment (enabling auto-charge for future installments)
- Replace isolated payment email links with "access your portal" emails
- Bilingual support (EN / PT-BR)
- Keep admin dashboard and client hub completely separate

## Non-Goals (Future Phases)

- Phase 2: Process status tracking + document downloads
- Phase 3: Form builder + onboarding forms
- Phase 4: English tests (quiz engine)

---

## 1. Data Model

### New: ClientUser

Separate from the internal `User` model (operators/admins). One ClientUser maps to one Customer.

```prisma
model ClientUser {
  id                    String    @id @default(cuid())
  email                 String    @unique
  passwordHash          String
  mustResetPw           Boolean   @default(true)
  tempPasswordExpiresAt DateTime?              // 24h expiry for temp passwords
  resetToken            String?   @unique      // password reset token (single-use)
  resetTokenExpiresAt   DateTime?              // reset token expiry (1h)
  failedLoginCount      Int       @default(0)  // for account lockout
  lockedUntil           DateTime?              // lockout timestamp
  language              String    @default("en") // "en" | "pt-BR"
  lastLoginAt           DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  customerId            String    @unique
  customer              Customer  @relation(fields: [customerId], references: [id])
}
```

**Relationship**: Add to Customer model:
```prisma
model Customer {
  // ... existing fields
  clientUser  ClientUser?
}
```

### No changes to existing models

Invoice, Payment, Contract, Deal — all remain unchanged. The hub reads them via existing Prisma queries filtered by `customerId`.

---

## 2. Authentication

### Strategy: JWT stored in httpOnly cookie

- Cookie name: `hub-token` (distinct from NextAuth's `next-auth.session-token`)
- JWT payload: `{ clientUserId, customerId, email }`
- Expiry: 30 days
- Refresh: sliding window — re-sign JWT with new expiry only when >50% of TTL has passed (avoids re-signing on every request)

### Why not NextAuth?

NextAuth is already configured for the admin dashboard with role-based access. Adding a second user type (ClientUser) to the same NextAuth config creates complexity and security risk. A lightweight JWT approach for the hub is simpler and fully isolated.

### Password handling

- Passwords hashed with bcrypt (12 rounds)
- Temporary password generated on account creation (8 chars, alphanumeric)
- `mustResetPw: true` forces password change on first login
- Password reset via email (Resend sends reset link with signed JWT token)
- Reset token: stored as `resetToken` on ClientUser, single-use, expires in 1 hour
- Temp password expiry: `tempPasswordExpiresAt` field, 24h from creation. After expiry, login with temp password fails and user must request a reset.
- Account lockout: after 10 cumulative failed logins, account locked for 1 hour (`lockedUntil`). Reset by password reset or admin.

### Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/hub/login` | Email + password login | Public |
| `/hub/reset-password` | Request password reset email | Public |
| `/hub/set-password?token=...` | Set new password (first access or reset) | Token in URL |
| `/hub/**` | All other hub pages | Requires valid `hub-token` |

### Middleware

**Middleware integration pattern**: The existing `middleware.ts` uses NextAuth's `withAuth` wrapper for `/dashboard/*`. Since Next.js allows only one middleware file, the approach is:

1. Export a top-level middleware function that checks the path
2. For `/dashboard/*` → delegate to existing NextAuth logic
3. For `/hub/*` (excluding login/reset routes) → custom JWT verification
4. This avoids NextAuth trying to validate hub routes

Hub middleware steps:
1. Read `hub-token` cookie
2. Verify JWT signature + expiry
3. If >50% TTL passed → re-sign and set new cookie (sliding window)
4. Inject `customerId` into request headers via `NextResponse.next({ headers })`
5. If invalid → redirect to `/hub/login`

**Rate limiting** on `/hub/login`: max 5 attempts per email per 15 minutes.
Implementation: Redis-based (Redis already in the stack for BullMQ). Key pattern: `hub-ratelimit:{email}`, TTL 15 minutes, increment on each attempt.

**CSRF protection**: All state-mutating hub endpoints (`POST`, `PUT`) verify the `Origin` header matches the app domain. Cookie uses `SameSite=Strict` (hub is single-domain, no cross-site navigation needed).

---

## 3. Hub Pages

### Dashboard (`/hub`)

Server component that fetches client data and renders:

**Header bar**: Carreira U.S.A. logo | Language toggle (EN/PT) | Logout button

**Summary cards**:
- Total Due (sum of unpaid invoices)
- Total Paid (sum of paid invoices)
- Next Due Date (earliest unpaid invoice due date)

**Invoice list**: All invoices for this customer, ordered by due date:

| Status | Display | Action |
|--------|---------|--------|
| PAID | Green checkmark, paid date | View receipt |
| SENT | Yellow badge | **Pay Now** button |
| OVERDUE | Red badge | **Pay Now** button |
| PARTIALLY_PAID | Orange badge, shows remaining balance | **Pay Now** button (for remaining) |
| DRAFT (upcoming) | Gray, future date | No action |

**Important**: The existing charge endpoint rejects non-SENT invoices. The hub charge endpoint must accept SENT, OVERDUE, and PARTIALLY_PAID statuses.

### Payment page (`/hub/pay/[invoiceId]`)

**New endpoint** `POST /api/hub/pay/[id]/charge` that:
1. Validates `hub-token` JWT
2. Verifies invoice belongs to the authenticated customer
3. Accepts SENT, OVERDUE, and PARTIALLY_PAID statuses
4. Delegates to the same QB Payments tokenize → save → charge logic

The existing `/api/payment-v2/[invoiceId]/charge` is unauthenticated and must NOT be reused directly. The hub charge endpoint wraps the same QB Payments logic with auth + ownership checks.

UI:
- Lives inside the hub layout (header, branding, session)
- Reuses `PaymentForm` component with i18n support (accepts `language` prop)
- On success → redirects to `/hub` with success toast (not a separate success page)
- Card + ACH tabs, Carreira Gold branding (already built)

### Settings (`/hub/settings`)

- Change language (EN / PT-BR)
- Change password
- View profile info (name, email — read-only, synced from Customer)

---

## 4. Hub APIs

All endpoints under `/api/hub/*`. Each verifies the `hub-token` JWT and scopes queries to the authenticated `customerId`.

```
POST /api/hub/auth/login          → Validate credentials, return JWT
POST /api/hub/auth/logout         → Clear hub-token cookie
POST /api/hub/auth/reset-password → Send reset email via Resend
POST /api/hub/auth/set-password   → Set new password (with token)

GET  /api/hub/invoices            → List all invoices for this customer
GET  /api/hub/invoices/[id]       → Invoice detail (with line items)
POST /api/hub/pay/[id]/charge     → Process payment (Card or ACH via QB Payments)

GET  /api/hub/profile             → Customer profile data
PUT  /api/hub/profile             → Update language, password
```

### Security constraints

- Every query includes `WHERE customerId = <authenticated_customer>`
- Invoice charge endpoint verifies invoice belongs to the customer
- No cross-customer data access possible
- All mutations logged to IntegrationLog

---

## 5. Email Changes

### New: Welcome email

**Trigger**: When deal is won and first invoice is created
**Via**: Resend (existing integration)
**Content**:
```
Subject: Welcome to Carreira U.S.A. — Your Account is Ready

Your client portal is ready. Access it to view your invoices and make payments.

Portal: https://carreirausa.sigmaintel.io/hub/login
Email: {customer_email}
Temporary password: {temp_password}

Please change your password on first login.
```

### Modified: Invoice notification email

**Before**: "You have a new invoice. Pay here: [direct payment link]"
**After**: "You have a new invoice. Access your portal to view and pay: [hub link]"

The email no longer contains a direct payment URL. It points to the hub where the customer sees all their invoices and pays.

### Existing emails unchanged

- Contract sent/reminder (DocuSign handles directly)
- Payment confirmation (still sent after successful payment)
- Payment reminders (still sent, but link points to hub instead of direct payment)

---

## 6. Integration with Existing Systems

### QB Payments (engine)

No changes. The hub's payment page calls the same QB Payments API methods:
- `tokenizeCard()` → `createCardFromToken()` → `chargeCard()`
- `tokenizeBankAccount()` → `createBankAccountFromToken()` → `chargeBankAccount()`

### Auto-charge cron

No changes. The cron already checks `getCustomerPaymentMethods()` and charges saved cards. Once a client pays through the hub (card saved), future installments are auto-charged.

### Invoice creation

No changes to the creation flow. The only addition is:
1. After invoice creation → check if ClientUser exists for this customer
2. If not → create ClientUser with temp password + send welcome email
3. If yes → send "new invoice available" email pointing to hub

### Notification service

Add new email templates (requires adding to `NotificationType` enum in Prisma schema):
- `HUB_WELCOME` — account created with temp password
- `HUB_INVOICE_AVAILABLE` — new invoice ready in portal
- `HUB_PASSWORD_RESET` — password reset link

Schema change: add these 3 values to the existing `NotificationType` enum + run migration.

---

## 7. Bilingual Support

### Approach: Client-side i18n with static strings

- Language stored in `ClientUser.language` field
- Toggle in hub header switches language and saves to DB
- Translation file: `lib/i18n/hub.ts` with key-value pairs for EN and PT-BR
- Server components receive language from JWT/session
- All hub components (including reused PaymentForm) accept a `language` prop
- No external i18n library needed — simple object lookup

```typescript
const t = {
  en: {
    dashboard: "Dashboard",
    totalDue: "Total Due",
    payNow: "Pay Now",
    // ...
  },
  "pt-BR": {
    dashboard: "Painel",
    totalDue: "Total Pendente",
    payNow: "Pagar Agora",
    // ...
  },
};
```

---

## 8. Design / Branding

- Carreira Gold color scheme (`#C9A84C`) — already established in payment-v2
- Background: `#FBF8F0` (warm cream)
- Cards: white with subtle shadow
- Consistent with the payment page already built
- Mobile-first responsive design

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Client sees other client's data | All queries scoped to `customerId` from JWT |
| Brute force login | Rate limiting: 5 attempts / 15min per email |
| Session hijacking | httpOnly + Secure + SameSite=Lax cookie |
| Admin/client boundary | Separate auth systems, separate middleware, separate routes |
| Card data (PCI) | Server-side tokenization (card data transits server over HTTPS). Acceptable for Phase 1 launch; Phase 1.1 should migrate to QB Payments JS client-side tokenization to remove server from PCI scope |
| CSRF | SameSite=Strict cookie + Origin header verification on all POST/PUT endpoints |
| Password storage | bcrypt with 12 rounds |
| Temp password exposure | Must reset on first login, 24h expiry |

---

## 10. File Structure

```
app/
  hub/
    login/page.tsx
    reset-password/page.tsx
    set-password/page.tsx
    page.tsx                    ← Dashboard
    pay/[invoiceId]/page.tsx    ← Payment (reuses PaymentForm)
    settings/page.tsx
    layout.tsx                  ← Hub layout (header, auth check)
  api/hub/
    auth/login/route.ts
    auth/logout/route.ts
    auth/reset-password/route.ts
    auth/set-password/route.ts
    invoices/route.ts
    invoices/[id]/route.ts
    pay/[id]/charge/route.ts
    profile/route.ts

lib/
  hub-auth.ts                   ← JWT sign/verify, middleware helper
  i18n/hub.ts                   ← Translation strings

middleware.ts                   ← Add /hub/* matcher
```

---

## 11. What Changes vs What Stays

| Component | Changes? | Detail |
|-----------|----------|--------|
| QB Payments API | No | Still the payment engine |
| Invoice creation flow | Minimal | Add ClientUser creation + welcome email |
| Auto-charge cron | No | Already works with saved cards |
| Admin dashboard | No | Completely separate |
| DocuSign contracts | No | Still handled externally |
| Payment page (payment-v2) | Reused | PaymentForm component reused inside hub |
| Notification service | Add templates | 3 new email templates |
| Prisma schema | Add model | ClientUser model + Customer relation |
| Middleware | Extend | Add /hub/* auth check |
