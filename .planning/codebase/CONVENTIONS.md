# Coding Conventions

**Analysis Date:** 2026-02-17

## Naming Patterns

**Files:**
- Services: `kebab-case.service.ts` (e.g., `lib/services/lead.service.ts`, `lib/services/quickbooks-sync.service.ts`)
- Exception: `lib/services/identity-mapper.ts` (no `.service` suffix -- legacy)
- Utilities: `kebab-case.ts` (e.g., `lib/utils/circuit-breaker.ts`, `lib/utils/error-fallback.ts`)
- API routes: `route.ts` inside directory structure (Next.js App Router convention)
- Components: `kebab-case.tsx` (e.g., `components/dashboard/kpi-card.tsx`, `components/ui/button.tsx`)
- Contexts: `kebab-case.context.tsx` (e.g., `lib/contexts/toast.context.tsx`)
- Scripts: `kebab-case.ts` in `scripts/` directory (e.g., `scripts/test-quickbooks.ts`)
- Prompts: `kebab-case.ts` in `lib/prompts/` (e.g., `lib/prompts/customer-service.ts`)

**Functions:**
- Use `camelCase` for all functions and methods: `createLead()`, `reconcileCustomer()`, `getOrCreateCustomer()`
- React components use `PascalCase`: `KpiCard`, `Button`, `ProfessionalSidebar`
- Exported component functions are named functions (not arrow): `export function Button({ ... })`

**Variables:**
- Use `camelCase` for all variables: `leadService`, `qualificationData`, `webhookSecret`
- Constants use `UPPER_SNAKE_CASE` only for true constants: `ITEMS_PER_PAGE`, `DATE_RANGES`
- Boolean prefixes: `is`, `has`, `should` (e.g., `isValid`, `hasClientId`, `shouldUpdate`)

**Types/Interfaces:**
- Use `PascalCase` for types and interfaces: `CreateLeadData`, `CustomerData`, `CircuitBreakerOptions`
- Interfaces preferred over type aliases for object shapes
- Suffix patterns: `*Data` for input DTOs, `*Result` for return types, `*Options` for config objects, `*Props` for component props
- Prisma enums imported directly from `@prisma/client`: `LeadStatus`, `LeadSource`, `UserRole`

**Database fields:**
- Prisma schema uses `camelCase` for fields: `createdAt`, `qualificationScore`, `quickbooks_id`
- Exception: external system IDs use `snake_case`: `pipedrive_id`, `quickbooks_id`, `stripe_id`, `docusign_id`
- Table names mapped via `@@map("tablename")` to lowercase plural: `@@map("users")`, `@@map("customers")`

## Code Style

**Formatting:**
- No Prettier config detected; rely on IDE defaults and ESLint
- Use 2-space indentation (inferred from all source files)
- Semicolons required (enforced by TypeScript strict mode)
- Double quotes for imports and JSX attributes
- Single quotes for template strings inside JSX

**Linting:**
- ESLint with `next/core-web-vitals` preset (config: `.eslintrc.json`)
- Disabled rules:
  - `@next/next/no-html-link-for-pages`: off
  - `react/no-unescaped-entities`: off
  - `@next/next/no-img-element`: off
- Run with: `npm run lint`

**TypeScript:**
- Strict mode enabled (`tsconfig.json` has `"strict": true`)
- Target: ES2020
- Module resolution: `bundler`
- `noEmit: true` (Next.js handles compilation)
- `skipLibCheck: true` for build performance
- `scripts/` directory excluded from `tsconfig.json` (run via `tsx`)

## Import Organization

**Order:**
1. React/Next.js core imports (`react`, `next/server`, `next/navigation`)
2. Third-party libraries (`zod`, `@prisma/client`, `lucide-react`, `stripe`)
3. Internal path-aliased imports (`@/lib/...`, `@/components/...`)
4. Relative imports (within same module, e.g., `./ai.service`)

**Path Aliases:**
- `@/*` maps to project root (configured in `tsconfig.json`)
- Always use `@/` for cross-directory imports: `import { prisma } from "@/lib/db"`
- Use relative imports only within the same service/module: `import { aiService } from "./ai.service"`

**Pattern for imports in API routes:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";
import { leadService } from "@/lib/services/lead.service";
import { createUserFallbackResponse, categorizeByStatusCode } from "@/lib/utils/error-fallback";
```

**Pattern for imports in components:**
```typescript
"use client"  // Always first line if client component

import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
```

## Error Handling

**API Routes - Standard Pattern:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = someSchema.parse(body);  // Zod validation first

    const result = await someService.doSomething(data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Handle Zod validation errors separately
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error doing something:", error);

    // Graceful fallback for integration errors
    const errorCategory = categorizeByStatusCode((error as any)?.status);
    const fallback = createUserFallbackResponse("service", "action", errorCategory);
    const statusCode = errorCategory === "transient" ? 202 : 500;
    return NextResponse.json(fallback, { status: statusCode });
  }
}
```

**Services - Throw errors up to route handler:**
```typescript
async qualifyLead(leadId: string): Promise<Lead> {
  const lead = await this.getLeadById(leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }
  // ... business logic
}
```

**External Integration Calls - Graceful Degradation:**
- Never let integration failures break the main operation
- Wrap external API calls in try/catch
- Log failures to `IntegrationLog` table via `integrationLogger`
- Return success for the primary operation with sync status metadata
- Pattern: "Don't fail customer creation if QB sync fails"

**Webhooks - Always return 200:**
- Webhooks always return `200 OK` even on errors (prevents external retries)
- Log errors for investigation
- Use `webhookResponse()` helper from `lib/utils/webhook-handler.ts`

**Circuit Breaker - External Services:**
- Use `CircuitBreaker` class from `lib/utils/circuit-breaker.ts` for external API calls
- Services like Stripe, QuickBooks wrap calls in `this.circuitBreaker.execute()`
- Throws `CircuitOpenError` when circuit is open

## Logging

**Framework:** `console.log` / `console.error` + `IntegrationLogger` for structured logs

**Console Log Patterns:**
- Use bracketed prefixes for context: `console.log("[AUTH] Login successful for:", email)`
- Prefix format: `[SERVICE_NAME]` or `[FEATURE_NAME]` in uppercase
- Examples: `[MIDDLEWARE]`, `[CUSTOMER_CREATE]`, `[Pipedrive Webhook Lead]`, `[IDENTITY_MAPPER]`

**IntegrationLogger (for external API calls):**
- Use `integrationLogger` singleton from `lib/utils/logger.ts`
- Log all external API operations (success AND failure)
- Methods: `.logSuccess(service, action, payload)`, `.logError(service, action, error, structuredError)`
- Stored in `IntegrationLog` database table

**When to use which:**
- `console.log` / `console.error`: Internal application flow, debugging
- `integrationLogger`: Any external API call (Pipedrive, QuickBooks, Stripe, DocuSign, Twilio)
- Direct `prisma.integrationLog.create`: In webhook handlers where logger import would be circular

## Comments

**When to Comment:**
- JSDoc block comments on all services, classes, and exported functions
- Inline comments for business rules and non-obvious logic
- Mixed language: Comments appear in both Portuguese and English
- Portuguese for business domain comments: `// Buscar Customer existente por email`
- English for technical comments: `// Don't fail customer creation if QB sync fails`

**JSDoc Pattern:**
```typescript
/**
 * Lead Service
 *
 * Responsabilidade: Gerenciar ciclo de vida do lead desde criacao ate conversao.
 * Regra: Lead so pode ser convertido em Deal se estiver QUALIFIED.
 */
export class LeadService {
  /**
   * Criar novo lead
   */
  async createLead(data: CreateLeadData): Promise<Lead> {
```

**Block Comment Separators:**
```typescript
/* ========================================
   DESIGN SYSTEM COLORS
   ======================================== */
```

## Function Design

**Size:** Services have focused methods, typically 10-40 lines each. No strict limit enforced.

**Parameters:**
- Use interface/type for complex parameters: `async createLead(data: CreateLeadData)`
- Use inline object types for simple filter parameters: `async listLeads(filters?: { status?: LeadStatus; limit?: number })`
- Optional parameters use `?` suffix

**Return Values:**
- Service methods return Prisma model types directly: `Promise<Lead>`, `Promise<Customer | null>`
- API routes return `NextResponse.json()` with consistent shapes
- Successful list endpoints return: `{ items: [...], pagination: { limit, offset, total } }`
- Successful create/update endpoints return the entity directly with status 201/200
- Error responses: `{ error: "message" }` or `FallbackResponse` shape for integration errors

## Module Design

**Exports:**
- Services export the class AND a singleton instance: `export class LeadService { ... }` + `export const leadService = new LeadService();`
- Always import the singleton, not the class: `import { leadService } from "@/lib/services/lead.service"`
- Utilities export named functions: `export function cn(...inputs: ClassValue[])`
- Components export named functions: `export function Button({ ... })`

**Barrel Files:** Not used. Import directly from the file.

**Service Pattern:**
```typescript
// lib/services/[name].service.ts
export class SomeService {
  // methods
}

export const someService = new SomeService();
```

## API Route Conventions

**Dynamic route config:**
- Add `export const dynamic = "force-dynamic";` to API routes that must not be cached

**Authentication in API routes:**
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userRole = (session.user as any).role;
const allowedRoles = ["ADMIN", "FINANCE"];
if (!allowedRoles.includes(userRole)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Validation:**
- Use Zod schemas defined at file scope for request body validation
- Schema naming: `createLeadSchema`, `createCustomerSchema`
- Call `.parse()` to validate and throw on failure

## Component Conventions

**Client vs Server Components:**
- Pages that need server data use server components (no `"use client"` directive): `app/dashboard/leads/page.tsx`
- Pages that need interactivity use `"use client"`: `app/dashboard/page.tsx`
- `"use client"` must be the first line of the file

**UI Component Library:**
- Custom components in `components/ui/` built with Radix UI primitives + Tailwind
- Use `cn()` utility from `lib/utils/cn.ts` for class merging (clsx + tailwind-merge)
- Design system uses CSS custom properties (design tokens) defined in `app/globals.css`
- Color palette: Gold brand theme (primary), with success/warning/error/info semantic colors

**State Management:**
- React Query (`@tanstack/react-query`) for server state via `QueryProvider`
- `useState` / `useEffect` for local component state
- No Redux or Zustand

**Provider Stack (in `app/layout.tsx`):**
```
SessionProvider > QueryProvider > ToastProvider > {children}
```

## Prisma Conventions

**Database Client:** Singleton from `lib/db.ts`, import as `import { prisma } from "@/lib/db"`

**Query patterns:**
- Use `findUnique` with `where` for single record by unique field
- Use `findMany` with `orderBy: { createdAt: "desc" }` as default sort
- Use `include` for eager loading relations
- Use `take` / `skip` for pagination

---

*Convention analysis: 2026-02-17*
