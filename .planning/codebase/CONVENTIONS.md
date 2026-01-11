# Coding Conventions

**Analysis Date:** 2026-01-09

## Naming Patterns

**Files:**
- kebab-case for all files: `lead.service.ts`, `identity-mapper.ts`, `webhook-validation.ts`
- API routes: `route.ts` (Next.js convention)
- Components: Mixed - files are kebab-case, exports may be PascalCase

**Functions:**
- camelCase for all functions: `createLead()`, `qualifyLead()`, `getLeadById()`
- Async functions: No special prefix - `async getLeadById(id: string)`
- Handlers: `handleWebhook()`, `processQueue()`, `validateSignature()`

**Variables:**
- camelCase for variables: `leadId`, `webhookSecret`, `userData`
- UPPER_SNAKE_CASE for constants: `QUALIFICATION_THRESHOLD`, `MAX_RETRIES`
- No underscore prefix for private (TypeScript private keyword used instead)

**Types:**
- PascalCase for interfaces and types: `CreateLeadData`, `UpdateLeadData`, `LeadService`
- No I prefix for interfaces (anti-pattern in TypeScript): `CreateLeadData` not `ICreateLeadData`
- PascalCase for enum names: `LeadStatus`, `DealStatus`, `InvoiceStatus`
- UPPER_SNAKE_CASE for enum values: `QUALIFIED`, `WON`, `DRAFT`

**Classes:**
- PascalCase: `LeadService`, `IdentityMapper`, `IntegrationLogger`
- Method names: camelCase: `createLead()`, `qualifyLead()`

## Code Style

**Formatting:**
- No formatter configured (Prettier not detected)
- Line length: Appears to be 100-120 characters (inferred from code)
- Quotes: Double quotes for strings (observed in code)
- Semicolons: Required (TypeScript/JavaScript standard)
- Indentation: 2 spaces (Next.js convention)

**Linting:**
- ESLint not detected (no `.eslintrc` found)
- TypeScript strict mode enabled (`tsconfig.json`)
- Type checking via `npm run build` or IDE

## Import Organization

**Order:**
1. External packages (react, next, prisma, zod)
2. Internal absolute imports (`@/lib/`, `@/components/`)
3. Relative imports (`./`, `../`)
4. Type imports (`import type { ... } from '...'`)

**Example:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { LeadStatus } from "@prisma/client";
import { z } from "zod";

import type { CreateLeadData } from "@/lib/services/lead.service";
```

**Grouping:**
- Blank line between external, internal absolute, and relative imports
- Alphabetical within each group
- Type imports at the end

**Path Aliases:**
- `@/` maps to project root (configured in `tsconfig.json`)
- Used consistently across all files

## Error Handling

**Patterns:**
- Services throw `Error` with descriptive messages
- API routes wrap in try/catch, log to `IntegrationLog`, return HTTP responses
- Validation errors use Zod for input validation
- Custom errors: Extend Error class or throw with message string

**Example:**
```typescript
try {
  const lead = await leadService.getLeadById(id);
  if (!lead) throw new Error("Lead not found");
  return NextResponse.json(lead);
} catch (error) {
  await integrationLogger.logError("lead-service", "getById", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status: 500 }
  );
}
```

**Async Errors:**
- Use try/catch, no .catch() chains
- Always await promises

## Logging

**Framework:**
- Custom IntegrationLog via `lib/utils/logger.ts`
- Logs to `IntegrationLog` database table
- No external logging service (Sentry/Datadog)
- Console.log for debug output visible in Vercel logs

**Patterns:**
- Log all external API calls (success and failure)
- `integrationLogger.logSuccess(service, action, payload)`
- `integrationLogger.logError(service, action, error, payload)`
- Include service name, action, and context in logs

**Example:**
```typescript
await integrationLogger.logSuccess("pipedrive", "dealWon", {
  dealId,
  customerId,
  value,
});
```

## Comments

**When to Comment:**
- Explain business logic or rules: `// Lead must be QUALIFIED before converting to Deal`
- Document complex algorithms: Above complex calculations
- Explain why, not what: `// Retry 3 times because Pipedrive API has rate limits`
- Avoid obvious comments: Don't comment `i++` or variable assignments

**JSDoc/TSDoc:**
- Used in service files for public methods
- Format: `/** Description here */` above function
- Example found in `lead.service.ts`, `pipedrive.service.ts`

**TODO Comments:**
- Format: `// TODO: Description` (no username or issue number unless relevant)
- Found in: `lib/utils/queue.ts`, `lib/services/invoice-workflow.service.ts`
- Examples: "TODO: Implementar lógica de geração de invoice"

## Function Design

**Size:**
- Keep under 50 lines where possible
- Extract helpers for complex logic
- Webhook handlers and service methods tend to be longer (100-200 lines)

**Parameters:**
- Max 3 parameters preferred
- Use object parameter for 4+: `async createLead(data: CreateLeadData)`
- Destructure in parameter list: `function process({ id, name }: ProcessParams)`

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Async functions return Promises: `async getById(id: string): Promise<Lead>`

**Validation:**
- Input validation via Zod schemas in API routes
- Business rule validation in services (e.g., status checks)
- Type safety via TypeScript (no runtime type checking needed)

## Module Design

**Exports:**
- Named exports preferred: `export const leadService = new LeadService()`
- Default exports rarely used
- Services exported as singletons: `export const myService = new MyService()`

**Barrel Files:**
- Not used extensively (no `index.ts` re-exports detected)
- Direct imports from specific service files

**Circular Dependencies:**
- Avoided by importing services in routes (not vice versa)
- Routes import services, services import database

## Database Patterns

**Prisma Usage:**
- `import { prisma } from "@/lib/db"` for all DB access
- Prisma Client used for queries
- Type definitions auto-generated from schema
- Use Prisma include/select for eager loading

**Enums:**
- Defined in `prisma/schema.prisma`
- Imported from `@prisma/client`: `import { LeadStatus, DealStatus } from "@prisma/client"`
- Used for type safety and validation

**Relations:**
- Foreign keys stored as fields: `customerId`, `leadId`
- Relations defined in schema with `@relation`
- Queries use `include` to fetch related data

## External API Integration

**Pattern:**
- Service wrapper for each external API
- Configuration via environment variables
- Webhook validation before processing
- All operations logged to IntegrationLog
- Error handling with try/catch and logging

**Example Services:**
- `pipedrive.service.ts` - Pipedrive API wrapper
- `quickbooks.service.ts` - QuickBooks OAuth and API
- `stripe.service.ts` - Stripe payment processing
- `identity-mapper.ts` - Customer deduplication

---

*Convention analysis: 2026-01-09*
*Update when patterns change*
