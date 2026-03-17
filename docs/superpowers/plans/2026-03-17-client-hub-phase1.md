# Client Hub Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a customer-facing portal where clients log in, view invoices, and pay with forced card saving — using QuickBooks Payments as the engine.

**Architecture:** Next.js App Router pages under `/hub/*` with JWT auth (jose library) stored in httpOnly cookie, separate from the admin NextAuth system. Hub APIs under `/api/hub/*` wrap existing QB Payments and Prisma logic with client ownership verification. Existing PaymentForm component reused with i18n support.

**Tech Stack:** Next.js 14, TypeScript, Prisma/PostgreSQL, jose (JWT), bcryptjs, Redis (ioredis), Resend, QB Payments API

**Spec:** `docs/superpowers/specs/2026-03-17-client-hub-phase1-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/hub-auth.ts` | JWT sign/verify, cookie helpers, password hashing, CSRF check |
| `lib/hub-rate-limit.ts` | Redis-based login rate limiting |
| `lib/i18n/hub.ts` | EN/PT-BR translation strings for all hub UI |
| `app/hub/layout.tsx` | Hub shell: header bar, auth gate, language context |
| `app/hub/login/page.tsx` | Login form (public) |
| `app/hub/reset-password/page.tsx` | Request password reset (public) |
| `app/hub/set-password/page.tsx` | Set new password via token (public) |
| `app/hub/page.tsx` | Dashboard: summary cards + invoice list |
| `app/hub/pay/[invoiceId]/page.tsx` | Payment page inside hub |
| `app/hub/settings/page.tsx` | Language + password change |
| `app/api/hub/auth/login/route.ts` | POST: validate credentials, set JWT cookie |
| `app/api/hub/auth/logout/route.ts` | POST: clear JWT cookie |
| `app/api/hub/auth/reset-password/route.ts` | POST: send reset email |
| `app/api/hub/auth/set-password/route.ts` | POST: set new password with token |
| `app/api/hub/invoices/route.ts` | GET: list invoices for authenticated client |
| `app/api/hub/invoices/[id]/route.ts` | GET: invoice detail |
| `app/api/hub/pay/[id]/charge/route.ts` | POST: authenticated charge (Card/ACH) |
| `app/api/hub/profile/route.ts` | GET/PUT: profile data + language/password |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ClientUser` model, add `clientUser` relation to Customer, add 3 values to `NotificationType` enum |
| `middleware.ts` | Split routing: `/dashboard/*` → NextAuth, `/hub/*` → custom JWT |
| `lib/services/notification.service.ts` | Add 3 email methods: `sendHubWelcome`, `sendHubInvoiceAvailable`, `sendHubPasswordReset` |
| `app/api/invoices/create/route.ts` | After invoice creation, auto-create ClientUser + send welcome email |
| `app/payment-v2/[invoiceId]/PaymentForm.tsx` | Accept `language` prop for i18n |
| `package.json` | Add `jose` dependency |

---

## Task 1: Install jose + Schema Migration

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Add ClientUser model to Prisma schema**

Add after the existing `User` model in `prisma/schema.prisma`:

```prisma
model ClientUser {
  id                    String    @id @default(cuid())
  email                 String    @unique
  passwordHash          String
  mustResetPw           Boolean   @default(true)
  tempPasswordExpiresAt DateTime?
  resetToken            String?   @unique
  resetTokenExpiresAt   DateTime?
  failedLoginCount      Int       @default(0)
  lockedUntil           DateTime?
  language              String    @default("en")
  lastLoginAt           DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  customerId            String    @unique
  customer              Customer  @relation(fields: [customerId], references: [id])

  @@map("client_users")
}
```

Add to the `Customer` model relations:

```prisma
  clientUser    ClientUser?
```

- [ ] **Step 3: Add NotificationType enum values**

Add to the existing `NotificationType` enum:

```prisma
enum NotificationType {
  // ... existing values ...
  HUB_WELCOME
  HUB_INVOICE_AVAILABLE
  HUB_PASSWORD_RESET
}
```

- [ ] **Step 4: Run migration**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat(hub): add ClientUser model and NotificationType values"
```

---

## Task 2: Hub Auth Library

**Files:**
- Create: `lib/hub-auth.ts`

- [ ] **Step 1: Create hub-auth.ts**

```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const HUB_COOKIE = "hub-token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "development-secret"
);
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface HubJwtPayload {
  clientUserId: string;
  customerId: string;
  email: string;
  language: string;
}

// ── JWT ────────────────────────────────────────────────────────

export async function signHubToken(payload: HubJwtPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function verifyHubToken(token: string): Promise<{ data: HubJwtPayload; iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      data: payload as unknown as HubJwtPayload,
      iat: (payload.iat || 0) as number,
    };
  } catch {
    return null;
  }
}

// ── Cookie ─────────────────────────────────────────────────────

export function setHubCookie(response: NextResponse, token: string) {
  response.cookies.set(HUB_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TTL_SECONDS,
    path: "/",
  });
}

export function clearHubCookie(response: NextResponse) {
  response.cookies.delete(HUB_COOKIE);
}

export function getHubTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(HUB_COOKIE)?.value;
}

// ── Middleware helper ──────────────────────────────────────────

export async function verifyHubRequest(
  request: NextRequest
): Promise<{ payload: HubJwtPayload; response: NextResponse } | null> {
  const token = getHubTokenFromRequest(request);
  if (!token) return null;

  const result = await verifyHubToken(token);
  if (!result) return null;

  const { data: payload, iat } = result;
  const response = NextResponse.next();

  // Inject customerId header for API routes
  response.headers.set("x-hub-customer-id", payload.customerId);
  response.headers.set("x-hub-client-user-id", payload.clientUserId);
  response.headers.set("x-hub-language", payload.language);

  // Sliding window: re-sign if >50% TTL passed
  const now = Math.floor(Date.now() / 1000);
  if (now - iat > TTL_SECONDS / 2) {
    const newToken = await signHubToken(payload);
    setHubCookie(response, newToken);
  }

  return { payload, response };
}

// ── Password ──────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── CSRF ──────────────────────────────────────────────────────

export function verifyCsrf(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return origin === allowed || origin === allowed.replace(/\/$/, "");
}

// ── Read auth from API route (NextRequest) ────────────────────

export async function getHubAuth(request: NextRequest): Promise<HubJwtPayload | null> {
  const token = getHubTokenFromRequest(request);
  if (!token) return null;
  const result = await verifyHubToken(token);
  return result?.data || null;
}

// ── Read auth from Server Component (cookies) ─────────────────

export async function getHubSession(): Promise<HubJwtPayload | null> {
  const { cookies: getCookies } = await import("next/headers");
  const cookieStore = getCookies();
  const token = cookieStore.get(HUB_COOKIE)?.value;
  if (!token) return null;
  const result = await verifyHubToken(token);
  return result?.data || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hub-auth.ts
git commit -m "feat(hub): add JWT auth library with cookie, password, and CSRF helpers"
```

---

## Task 3: Rate Limiting + i18n

**Files:**
- Create: `lib/hub-rate-limit.ts`
- Create: `lib/i18n/hub.ts`

- [ ] **Step 1: Create rate limiter**

```typescript
// lib/hub-rate-limit.ts
import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.REDIS_URL) return null;
  try {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    return redis;
  } catch {
    return null;
  }
}

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

export async function checkRateLimit(email: string): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedis();
  if (!client) return { allowed: true, remaining: MAX_ATTEMPTS }; // fail open if no Redis

  const key = `hub-ratelimit:${email.toLowerCase()}`;
  const current = await client.incr(key);

  if (current === 1) {
    await client.expire(key, WINDOW_SECONDS);
  }

  return {
    allowed: current <= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - current),
  };
}

export async function clearRateLimit(email: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.del(`hub-ratelimit:${email.toLowerCase()}`);
}
```

- [ ] **Step 2: Create i18n translations**

```typescript
// lib/i18n/hub.ts
const translations = {
  en: {
    // Header
    logout: "Logout",
    settings: "Settings",

    // Dashboard
    welcome: "Welcome",
    totalDue: "Total Due",
    totalPaid: "Total Paid",
    nextDue: "Next Due",
    noInvoices: "No invoices yet.",
    invoices: "Invoices",
    payNow: "Pay Now",
    paid: "Paid",
    overdue: "Overdue",
    pending: "Pending",
    upcoming: "Upcoming",
    partiallyPaid: "Partially Paid",
    viewReceipt: "View Receipt",

    // Payment
    paymentTitle: "Payment Details",
    cardTab: "Credit / Debit Card",
    achTab: "Bank Transfer (ACH)",
    cardNumber: "Card Number",
    expiry: "Expiration",
    cvc: "CVC",
    cardName: "Name on Card",
    zip: "ZIP Code",
    routingNumber: "Routing Number",
    accountNumber: "Account Number",
    accountHolder: "Account Holder Name",
    accountType: "Account Type",
    checking: "Checking Account",
    savings: "Savings Account",
    phone: "Phone",
    payAmount: "Pay",
    processing: "Processing...",
    securePayment: "Secure payment · Processed by QuickBooks Payments",
    cardSavedNote: "Your card will be saved for automatic future payments.",
    achSavedNote: "Your bank account will be saved for future payments.",

    // Login
    loginTitle: "Client Portal",
    loginSubtitle: "Sign in to your account",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    forgotPassword: "Forgot password?",
    loginError: "Invalid email or password.",
    accountLocked: "Account locked. Try again later or reset your password.",

    // Set/Reset Password
    setPasswordTitle: "Set Your Password",
    resetPasswordTitle: "Reset Password",
    resetPasswordSubtitle: "Enter your email to receive a reset link.",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    sendResetLink: "Send Reset Link",
    resetLinkSent: "If an account exists, a reset link has been sent.",
    passwordUpdated: "Password updated. You can now sign in.",
    passwordMismatch: "Passwords don't match.",
    passwordTooShort: "Password must be at least 8 characters.",

    // Settings
    settingsTitle: "Settings",
    language: "Language",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    profile: "Profile",
    saved: "Saved!",

    // Errors
    connectionError: "Connection error. Try again.",
    invalidCard: "Invalid card. Check details and try again.",
    paymentDeclined: "Payment declined. Try another method.",
    invoiceNotFound: "Invoice not found.",
    invoiceAlreadyPaid: "This invoice is already paid.",
    bankDataInvalid: "Invalid bank details. Check and try again.",
  },
  "pt-BR": {
    // Header
    logout: "Sair",
    settings: "Configurações",

    // Dashboard
    welcome: "Bem-vindo",
    totalDue: "Total Pendente",
    totalPaid: "Total Pago",
    nextDue: "Próx. Vencimento",
    noInvoices: "Nenhuma fatura encontrada.",
    invoices: "Faturas",
    payNow: "Pagar Agora",
    paid: "Pago",
    overdue: "Em Atraso",
    pending: "Pendente",
    upcoming: "Próxima",
    partiallyPaid: "Parcialmente Pago",
    viewReceipt: "Ver Recibo",

    // Payment
    paymentTitle: "Dados de Pagamento",
    cardTab: "Cartão de Crédito / Débito",
    achTab: "Transferência Bancária (ACH)",
    cardNumber: "Número do Cartão",
    expiry: "Validade",
    cvc: "CVC",
    cardName: "Nome no Cartão",
    zip: "ZIP Code",
    routingNumber: "Routing Number",
    accountNumber: "Número da Conta",
    accountHolder: "Nome do Titular",
    accountType: "Tipo de Conta",
    checking: "Conta Corrente",
    savings: "Conta Poupança",
    phone: "Telefone",
    payAmount: "Pagar",
    processing: "Processando...",
    securePayment: "Pagamento seguro · Processado por QuickBooks Payments",
    cardSavedNote: "Seu cartão será salvo para pagamentos automáticos futuros.",
    achSavedNote: "Sua conta bancária será salva para pagamentos futuros.",

    // Login
    loginTitle: "Portal do Cliente",
    loginSubtitle: "Entre na sua conta",
    email: "Email",
    password: "Senha",
    signIn: "Entrar",
    forgotPassword: "Esqueceu a senha?",
    loginError: "Email ou senha inválidos.",
    accountLocked: "Conta bloqueada. Tente mais tarde ou redefina sua senha.",

    // Set/Reset Password
    setPasswordTitle: "Defina Sua Senha",
    resetPasswordTitle: "Redefinir Senha",
    resetPasswordSubtitle: "Digite seu email para receber o link de redefinição.",
    newPassword: "Nova Senha",
    confirmPassword: "Confirmar Senha",
    sendResetLink: "Enviar Link",
    resetLinkSent: "Se a conta existir, um link foi enviado.",
    passwordUpdated: "Senha atualizada. Você já pode entrar.",
    passwordMismatch: "As senhas não coincidem.",
    passwordTooShort: "A senha deve ter pelo menos 8 caracteres.",

    // Settings
    settingsTitle: "Configurações",
    language: "Idioma",
    changePassword: "Alterar Senha",
    currentPassword: "Senha Atual",
    profile: "Perfil",
    saved: "Salvo!",

    // Errors
    connectionError: "Erro de conexão. Tente novamente.",
    invalidCard: "Cartão inválido. Verifique os dados.",
    paymentDeclined: "Pagamento recusado. Tente outro método.",
    invoiceNotFound: "Fatura não encontrada.",
    invoiceAlreadyPaid: "Esta fatura já foi paga.",
    bankDataInvalid: "Dados bancários inválidos. Verifique e tente novamente.",
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export function t(lang: Language, key: TranslationKey): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}

export function getTranslations(lang: Language) {
  return translations[lang] || translations.en;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/hub-rate-limit.ts lib/i18n/hub.ts
git commit -m "feat(hub): add rate limiting and i18n translation strings"
```

---

## Task 4: Hub Auth APIs

**Files:**
- Create: `app/api/hub/auth/login/route.ts`
- Create: `app/api/hub/auth/logout/route.ts`
- Create: `app/api/hub/auth/reset-password/route.ts`
- Create: `app/api/hub/auth/set-password/route.ts`

- [ ] **Step 1: Create login API**

`app/api/hub/auth/login/route.ts`:
- Accept `{ email, password }`
- Check rate limit (Redis)
- Find ClientUser by email
- Check `lockedUntil` (account lockout)
- Check `tempPasswordExpiresAt` (expired temp passwords)
- Verify password with bcrypt
- On failure: increment `failedLoginCount`, lock after 10 failures
- On success: reset `failedLoginCount`, update `lastLoginAt`
- If `mustResetPw`: generate `resetToken` (crypto.randomUUID), set `resetTokenExpiresAt` (1 hour), save to DB. Return `{ mustResetPw: true, resetToken }`. Frontend redirects to `/hub/set-password?token=XXX`. No JWT cookie set yet — user must set password first.
- If NOT `mustResetPw`: sign JWT, set cookie, return `{ success: true, language }`

- [ ] **Step 2: Create logout API**

`app/api/hub/auth/logout/route.ts`:
- Verify CSRF (Origin header)
- Clear `hub-token` cookie
- Return `{ success: true }`

- [ ] **Step 3: Create reset-password API**

`app/api/hub/auth/reset-password/route.ts`:
- Accept `{ email }`
- Find ClientUser by email
- Generate `resetToken` (crypto.randomUUID), set `resetTokenExpiresAt` (1 hour)
- Send reset email via notification service
- Always return success (don't leak whether email exists)

- [ ] **Step 4: Create set-password API**

`app/api/hub/auth/set-password/route.ts`:
- Accept `{ token, password }`
- Find ClientUser by `resetToken`
- Check `resetTokenExpiresAt` not expired
- Hash new password, clear `resetToken`, set `mustResetPw: false`
- Clear rate limit for this email
- Return `{ success: true }`

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/auth/
git commit -m "feat(hub): add auth APIs (login, logout, reset-password, set-password)"
```

---

## Task 5: Middleware Update

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Refactor middleware to handle both /dashboard/* and /hub/***

The current middleware exports `withAuth(...)` which wraps the entire middleware function. This CANNOT be called conditionally. Replace `withAuth` with `getToken` from `next-auth/jwt` for the dashboard branch.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyHubRequest, verifyCsrf } from "@/lib/hub-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Dashboard routes: NextAuth via getToken ──
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/dashboard")) {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Existing RBAC logic using token.role (port from current withAuth callback)
    // ...
    return NextResponse.next();
  }

  // ── Hub public routes: no auth needed ──
  const hubPublicPaths = ["/hub/login", "/hub/reset-password", "/hub/set-password"];
  if (hubPublicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Hub protected routes: custom JWT ──
  if (pathname.startsWith("/hub") || pathname.startsWith("/api/hub")) {
    // CSRF check for POST/PUT on API routes
    if (pathname.startsWith("/api/hub") && ["POST", "PUT"].includes(request.method)) {
      if (!verifyCsrf(request)) {
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
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*", "/hub/:path*", "/api/hub/:path*"],
};
```

Port the existing RBAC `routeRoleMap` logic from the current `withAuth` callback into the dashboard branch, using `token.role` from `getToken()`.

- [ ] **Step 2: Test both auth paths still work**

```bash
# Admin dashboard still requires NextAuth session
curl -s http://localhost:3000/dashboard -o /dev/null -w "%{http_code}"
# Expected: 302 (redirect to login)

# Hub requires hub-token
curl -s http://localhost:3000/hub -o /dev/null -w "%{http_code}"
# Expected: 302 (redirect to /hub/login)

# Hub login is public
curl -s http://localhost:3000/hub/login -o /dev/null -w "%{http_code}"
# Expected: 200
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(hub): split middleware for admin (NextAuth) and hub (JWT) auth"
```

---

## Task 6: Hub Data APIs

**Files:**
- Create: `app/api/hub/invoices/route.ts`
- Create: `app/api/hub/invoices/[id]/route.ts`
- Create: `app/api/hub/profile/route.ts`

- [ ] **Step 1: Create invoices list API**

`GET /api/hub/invoices`:
- Read `customerId` from hub JWT (via `getHubAuth`)
- Query: `prisma.invoice.findMany({ where: { customerId }, orderBy: { dueDate: 'asc' } })`
- Return: `{ invoices: [{ id, invoiceNumber, amount, amountPaid, status, dueDate, paidAt }] }`

- [ ] **Step 2: Create invoice detail API**

`GET /api/hub/invoices/[id]`:
- Read `customerId` from hub JWT
- Query: `prisma.invoice.findUnique({ where: { id, customerId } })`
- If not found or wrong customer → 404
- Return full invoice with `lineItems` JSON field

- [ ] **Step 3: Create profile API**

`GET /api/hub/profile`:
- Read `customerId` + `clientUserId` from hub JWT
- Query Customer (name, email, phone) + ClientUser (language)
- Return: `{ name, email, phone, language }`

`PUT /api/hub/profile`:
- Verify CSRF (Origin header)
- Accept `{ language?, currentPassword?, newPassword? }`
- If language change: update `ClientUser.language`, re-sign JWT with new language
- If password change: verify current password, hash new, update

- [ ] **Step 4: Commit**

```bash
git add app/api/hub/invoices/ app/api/hub/profile/
git commit -m "feat(hub): add invoice list, detail, and profile APIs"
```

---

## Task 7: Hub Charge API

**Files:**
- Create: `app/api/hub/pay/[id]/charge/route.ts`

- [ ] **Step 1: Create authenticated charge endpoint**

Same logic as `/api/payment-v2/[invoiceId]/charge` but with:
1. Verify hub JWT via `getHubAuth(request)`
2. Verify `invoice.customerId === payload.customerId` (ownership check)
3. Accept SENT, OVERDUE, and PARTIALLY_PAID statuses (not just SENT)
4. For PARTIALLY_PAID: charge `amount - amountPaid` (remaining balance)
5. CSRF check via `verifyCsrf(request)`
6. Delegates to same QB Payments methods: `tokenizeCard` → `createCardFromToken` → `chargeCard`

Extract `processCardPayment` and `processAchPayment` from `app/api/payment-v2/[invoiceId]/charge/route.ts` (lines 148-274) into a shared module `lib/services/payment-processing.ts`. Both the payment-v2 route and the hub charge route import from this shared module. Do NOT duplicate the QB Payments logic.

- [ ] **Step 2: Commit**

```bash
git add app/api/hub/pay/
git commit -m "feat(hub): add authenticated charge endpoint with ownership verification"
```

---

## Task 8: Hub Layout

**Files:**
- Create: `app/hub/layout.tsx`

- [ ] **Step 1: Create hub layout**

Server component that:
1. Reads `hub-token` cookie via `cookies()` from `next/headers`
2. Verifies JWT and extracts `language`
3. If on a public route (`/hub/login`, `/hub/reset-password`, `/hub/set-password`): render children without header
4. If authenticated: render header bar + children
5. If not authenticated on protected route: redirect to `/hub/login`

Header bar:
- Left: "Carreira U.S.A." text
- Right: Language toggle (EN | PT-BR) + Settings link + Logout button
- Carreira Gold branding (`#C9A84C` accent, `#FBF8F0` background)
- Mobile responsive

Language toggle: links to `/api/hub/profile` PUT to update language, then refreshes page.

- [ ] **Step 2: Commit**

```bash
git add app/hub/layout.tsx
git commit -m "feat(hub): add layout with header, auth gate, and language toggle"
```

---

## Task 9: Hub Login + Password Pages

**Files:**
- Create: `app/hub/login/page.tsx`
- Create: `app/hub/reset-password/page.tsx`
- Create: `app/hub/set-password/page.tsx`

- [ ] **Step 1: Create login page**

Client component with:
- Email + password form
- Carreira Gold branding
- "Forgot password?" link → `/hub/reset-password`
- On submit: POST to `/api/hub/auth/login`
- If `mustResetPw: true` → redirect to `/hub/set-password`
- If success → redirect to `/hub`
- Error messages for invalid credentials, locked account
- i18n: detect browser language for initial display, or default to EN

- [ ] **Step 2: Create reset-password page**

Client component with:
- Email field + "Send Reset Link" button
- POST to `/api/hub/auth/reset-password`
- Always shows success message (don't leak email existence)
- Link back to login

- [ ] **Step 3: Create set-password page**

Client component with:
- Reads `?token=xxx` from URL
- New password + confirm password fields
- Minimum 8 characters validation
- POST to `/api/hub/auth/set-password`
- On success → redirect to `/hub/login` with "Password updated" message

- [ ] **Step 4: Commit**

```bash
git add app/hub/login/ app/hub/reset-password/ app/hub/set-password/
git commit -m "feat(hub): add login, reset-password, and set-password pages"
```

---

## Task 10: Hub Dashboard Page

**Files:**
- Create: `app/hub/page.tsx`

- [ ] **Step 1: Create dashboard**

Server component that:
1. Gets `customerId` and `language` from hub JWT (via layout or cookies)
2. Fetches invoices: `prisma.invoice.findMany({ where: { customerId }, orderBy: { dueDate: 'asc' }, include: { customer: true } })`
3. Computes summary cards:
   - Total Due: sum of unpaid invoices (SENT + OVERDUE + PARTIALLY_PAID)
   - Total Paid: sum of PAID invoices (`amountPaid`)
   - Next Due: earliest due date among unpaid invoices
4. Renders invoice list with status badges and Pay Now buttons

Status badge mapping:
- PAID → green checkmark
- SENT → yellow "Pending"
- OVERDUE → red "Overdue"
- PARTIALLY_PAID → orange with remaining amount
- DRAFT → gray "Upcoming"

"Pay Now" button links to `/hub/pay/[invoiceId]`

All text via `t(language, key)` from `lib/i18n/hub.ts`.

Branding: Carreira Gold (`#C9A84C`), cream background (`#FBF8F0`), white cards with shadow, same style as payment-v2.

- [ ] **Step 2: Commit**

```bash
git add app/hub/page.tsx
git commit -m "feat(hub): add dashboard with summary cards and invoice list"
```

---

## Task 11: Hub Payment Page

**Files:**
- Create: `app/hub/pay/[invoiceId]/page.tsx`
- Modify: `app/payment-v2/[invoiceId]/PaymentForm.tsx` (add `language` prop)

- [ ] **Step 1: Add i18n + configurable props to PaymentForm**

Modify `PaymentForm.tsx`:
- Add `language?: string` to Props interface (defaults to `"en"`)
- Add `chargeEndpoint?: string` to Props (defaults to `/api/payment-v2/${invoiceId}/charge`)
- Add `onSuccess?: () => void` callback prop (defaults to `router.push(/payment/success?...)`)
- Replace hardcoded fetch URL at line 135 with `chargeEndpoint` prop
- Replace hardcoded success redirect at line 146 with `onSuccess` callback
- Replace all hardcoded strings with `t(language, key)` lookups
- Import `t` from `lib/i18n/hub.ts`

This keeps the component working standalone (payment-v2 with defaults) AND inside the hub (with custom endpoint + redirect).

- [ ] **Step 2: Create hub payment page**

Server component that:
1. Gets `customerId` and `language` from hub JWT
2. Loads invoice + verifies ownership (`invoice.customerId === customerId`)
3. Checks invoice status is SENT, OVERDUE, or PARTIALLY_PAID
4. For PARTIALLY_PAID: passes `amount - amountPaid` as the charge amount
5. Renders `PaymentForm` with `language` prop
6. PaymentForm posts to `/api/hub/pay/[id]/charge` (authenticated endpoint)
7. On success → redirects to `/hub` (not to separate success page)

- [ ] **Step 3: Commit**

```bash
git add app/hub/pay/ app/payment-v2/[invoiceId]/PaymentForm.tsx
git commit -m "feat(hub): add payment page with i18n PaymentForm"
```

---

## Task 12: Hub Settings Page

**Files:**
- Create: `app/hub/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Client component with:
- **Language section**: EN / PT-BR toggle buttons, saves via PUT `/api/hub/profile`
- **Change Password section**: current password + new password + confirm, saves via PUT `/api/hub/profile`
- **Profile section**: name, email (read-only, from Customer)
- Carreira Gold branding
- Success/error toast messages
- All text via i18n

- [ ] **Step 2: Commit**

```bash
git add app/hub/settings/
git commit -m "feat(hub): add settings page with language and password management"
```

---

## Task 13: Email Templates

**Files:**
- Modify: `lib/services/notification.service.ts`

- [ ] **Step 1: Add hub email methods**

Add 3 new public methods following the existing pattern (see `sendContractForSignature` as template):

**`sendHubWelcome(customer, tempPassword)`**:
- Subject: "Welcome to Carreira U.S.A. — Your Account is Ready"
- Body: portal link, email, temp password, "please change on first login"
- Type: `NotificationType.HUB_WELCOME`

**`sendHubInvoiceAvailable(customer, invoice)`**:
- Subject: "New Invoice Available — Carreira U.S.A."
- Body: invoice number, amount, due date, "access your portal to pay" link
- Type: `NotificationType.HUB_INVOICE_AVAILABLE`

**`sendHubPasswordReset(customer, resetUrl)`**:
- Subject: "Password Reset — Carreira U.S.A."
- Body: reset link (valid 1 hour), security note
- Type: `NotificationType.HUB_PASSWORD_RESET`

Each method: generates HTML, calls `this.sendEmail(...)` with proper relations.

- [ ] **Step 2: Commit**

```bash
git add lib/services/notification.service.ts
git commit -m "feat(hub): add welcome, invoice, and password reset email templates"
```

---

## Task 14: Invoice Creation Hook

**Files:**
- Modify: `app/api/invoices/create/route.ts`

- [ ] **Step 1: Add ClientUser auto-creation after invoice creation**

At lines ~551-590 (after invoice creation, before return), add:

```typescript
// Auto-create ClientUser for hub access
try {
  const existingClientUser = await prisma.clientUser.findUnique({
    where: { customerId: customer.id },
  });

  if (!existingClientUser) {
    // First invoice for this customer → create hub account
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.clientUser.create({
      data: {
        email: customer.email,
        passwordHash,
        mustResetPw: true,
        tempPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        customerId: customer.id,
        language: customer.preferredLanguage === "pt-BR" ? "pt-BR" : "en",
      },
    });
    // Send welcome email with temp password
    await notificationService.sendHubWelcome(customer, tempPassword);
    console.log(`[INVOICE_CREATE] ClientUser created for ${customer.email}`);
  } else {
    // Existing client → send ONE "new invoice available" email per API call
    // (covers the whole series, not one email per installment)
    await notificationService.sendHubInvoiceAvailable(customer, invoices[0]);
    console.log(`[INVOICE_CREATE] Hub invoice notification sent to ${customer.email}`);
  }
} catch (hubError: any) {
  // Non-blocking — invoice creation should not fail because of hub
  console.error("[INVOICE_CREATE] Hub account setup failed:", hubError.message);
}
```

Import `generateTempPassword` and `hashPassword` from `lib/hub-auth.ts`.

- [ ] **Step 2: Commit**

```bash
git add app/api/invoices/create/route.ts
git commit -m "feat(hub): auto-create ClientUser and send welcome email on first invoice"
```

---

## Task 15: Final Integration + Cleanup

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```
Fix any errors.

- [ ] **Step 2: Test full flow locally**

1. Create a test ClientUser manually (or trigger via invoice creation)
2. Login at `/hub/login`
3. Verify dashboard shows invoices
4. Click "Pay Now" → verify payment form loads
5. Test password reset flow
6. Test language toggle

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(hub): Client Hub Phase 1 complete — auth, dashboard, invoices, payment"
```

- [ ] **Step 4: Deploy**

```bash
git push origin main
```
