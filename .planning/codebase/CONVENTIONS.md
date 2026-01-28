# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- Services: `*.service.ts` (lowercase with dashes) - e.g., `ai.service.ts`, `identity-mapper.ts`
- API Routes: `route.ts` (Next.js App Router convention)
- Components: `*.tsx` (kebab-case) - e.g., `dashboard-header.tsx`, `kpi-card.tsx`
- Utils: `*.ts` (kebab-case) - e.g., `circuit-breaker.ts`, `webhook-handler.ts`
- Scripts: `*.ts` in `scripts/` directory - e.g., `test-quickbooks.ts`

**Functions:**
- camelCase for all functions - e.g., `createLead()`, `reconcileCustomer()`, `qualifyLead()`
- Async functions explicitly use `async` keyword
- Private methods prefixed with underscore when needed - e.g., `_extractErrorCode()`, `_categorizeError()`

**Variables:**
- camelCase for variables - e.g., `leadId`, `conversationHistory`, `webhookSecret`
- UPPER_SNAKE_CASE for constants - e.g., `AI_MODEL`, `AI_TEMPERATURE`, `CUSTOMER_SERVICE_SYSTEM_PROMPT`
- Descriptive names preferred over abbreviations

**Types/Interfaces:**
- PascalCase - e.g., `ChatMessage`, `QualificationResult`, `ExternalIds`
- Interface names descriptive without "I" prefix - e.g., `CustomerData` not `ICustomerData`
- Type aliases for simple unions - e.g., `type ButtonVariant = "primary" | "secondary"`

**Classes:**
- PascalCase - e.g., `AIService`, `IdentityMapperService`, `IntegrationLogger`
- Exported as singleton instances with camelCase - e.g., `export const aiService = new AIService()`

## Code Style

**Formatting:**
- Tool: Next.js default (no Prettier/custom config detected)
- Indentation: 2 spaces
- String quotes: Double quotes preferred
- Semicolons: Used consistently
- Line length: No enforced limit (files show natural wrapping ~80-120 chars)

**Linting:**
- Tool: ESLint with `next/core-web-vitals` config
- Rules disabled:
  - `@next/next/no-html-link-for-pages: off`
  - `react/no-unescaped-entities: off`
  - `@next/next/no-img-element: off`

**TypeScript:**
- Strict mode enabled (`"strict": true`)
- Module resolution: `bundler`
- Target: ES2020
- JSX: `preserve` (handled by Next.js)
- No `any` usage where avoidable - prefer explicit types
- Null checks common: `if (!data)`, `data?.field`

## Import Organization

**Order:**
1. External packages - e.g., `import OpenAI from "openai"`
2. Next.js framework imports - e.g., `import { NextRequest, NextResponse } from "next/server"`
3. Local services/utils with `@/` alias - e.g., `import { aiService } from "@/lib/services/ai.service"`
4. Prisma types - e.g., `import { LeadStatus, LeadSource } from "@prisma/client"`
5. Type-only imports separated when needed

**Path Aliases:**
- `@/*` maps to project root - e.g., `@/lib/services`, `@/components/ui`

**Pattern:**
```typescript
// External
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

// Local services
import { aiService } from "@/lib/services/ai.service";
import { prisma } from "@/lib/db";

// Types
import { ChatMessage, QualificationResult } from "./types";
import { LeadStatus } from "@prisma/client";
```

## Error Handling

**Patterns:**
- Try-catch blocks around all async operations
- 135+ try-catch blocks in services directory
- Return null or throw based on context
- Log errors to IntegrationLog table using `integrationLogger`

**Service Layer:**
```typescript
async function operationName() {
  try {
    // Operation
    return result;
  } catch (error) {
    console.error("Error in operationName:", error);
    
    // Log to IntegrationLog
    await integrationLogger.logError(
      "SERVICE_NAME",
      "ACTION_NAME",
      error,
      { /* structured error data */ }
    );
    
    // Either throw or return fallback
    throw new Error("Failed to perform operation");
  }
}
```

**API Routes:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Process request
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Graceful Degradation:**
- Missing API keys return default/fallback responses
- Example: `aiService.chatWithLead()` returns error message if `OPENAI_API_KEY` missing
- Example: `qualifyLead()` returns score of 50 if API unavailable

**Structured Error Logging:**
```typescript
const structured: StructuredErrorData = {
  errorCode: "CIRCUIT_OPEN",
  category: "transient",
  severity: "error",
  recovery: "wait",
  metadata: { email: leadContext.email },
};

await integrationLogger.logError(
  "openai",
  "chatWithLead",
  error,
  structured,
  { email: leadContext.email }
);
```

## Logging

**Framework:** Custom `IntegrationLogger` class (`lib/utils/logger.ts`)

**Database-backed:** All logs stored in `IntegrationLog` table via Prisma

**Patterns:**
```typescript
// Success
await integrationLogger.logSuccess("SERVICE", "ACTION", payload);

// Error
await integrationLogger.logError("SERVICE", "ACTION", error, structuredData, payload);

// Partial (success with warnings)
await integrationLogger.logPartial("SERVICE", "ACTION", payload);
```

**Console Logging:**
- Use `console.log()` for development/debugging
- Use `console.error()` for errors (always paired with IntegrationLog)
- Use `console.warn()` for warnings
- Prefix convention: `[SERVICE]` or `[COMPONENT]` - e.g., `[AI]`, `[IDENTITY_MAPPER]`, `[AUTH]`

**When to Log:**
- All external API calls (success or failure)
- Webhook receipt and processing
- Authentication events
- Data sync operations
- Error conditions

**Sensitive Data:**
- Logger filters sensitive keys: `token`, `apiKey`, `secret`, `password`, `auth`, `bearer`
- Filtered data replaced with `[REDACTED]`

## Comments

**When to Comment:**
- Complex business logic requiring explanation
- API endpoint documentation at function start
- Service class responsibilities in docstrings
- Webhook flow steps numbered inline

**JSDoc/TSDoc:**
- Used for public service methods
- Describes purpose, parameters, return values
- Pattern:
```typescript
/**
 * Reconciliar ou criar Customer baseado em email e IDs externos
 */
async reconcileCustomer(data: CustomerData): Promise<Customer> {
  // Implementation
}

/**
 * POST /api/chat
 * 
 * Chatbot API para Customer Service com AI
 * 
 * Fluxo:
 * 1. Validar leadId
 * 2. Buscar ou criar Conversation
 * 3. Buscar histórico de mensagens
 * 4. Chamar AI Service com contexto completo
 */
```

**Business Rules:**
- Critical rules documented inline with `// Regra:` or `// Critical Rule:`
- Example: `// Regra crítica: Nunca criar duplicatas. Email é chave única.`

**TODOs:**
- 6 TODO comments across codebase
- Format: `// TODO: Description`
- Located in: `lib/utils/queue.ts`, `lib/services/sdr.service.ts`, `lib/services/invoice-workflow.service.ts`

## Function Design

**Size:** No strict limit, but preference for focused functions (50-150 lines common)

**Parameters:** 
- Use destructured objects for multiple params
- Optional params typed with `?` - e.g., `phone?: string`
- Prefer interfaces for complex parameter shapes

**Pattern:**
```typescript
async function createLead(data: CreateLeadData): Promise<Lead> {
  return prisma.lead.create({
    data: {
      email: data.email,
      name: data.name,
      phone: data.phone,
      source: data.source || LeadSource.WEBSITE,
      status: LeadStatus.NEW,
    },
  });
}
```

**Return Values:**
- Explicit return types always specified
- Promise types for async functions - e.g., `Promise<Customer>`
- Null return for "not found" cases - e.g., `Promise<Customer | null>`
- Throw errors for failures, return null for missing data

## Module Design

**Exports:**
- Services: Named class export + singleton instance
  ```typescript
  export class AIService { }
  export const aiService = new AIService();
  ```
- Utils: Named function exports
- Components: Default export for React components
- Types: Named exports from same file or separate `types.ts`

**Barrel Files:** Not used (no `index.ts` re-exports detected)

**Service Pattern:**
- Stateless services with dependency injection via constructor or imports
- Singleton pattern for services (instantiated once, exported)
- Database access via `prisma` singleton from `@/lib/db`

**Circular Dependency Avoidance:**
- Dynamic imports when needed:
  ```typescript
  const { docusignService } = await import("./docusign.service");
  ```

## Async Patterns

**238+ async functions** across codebase

**Await Usage:**
- All Prisma calls awaited
- External API calls awaited
- Sequential when dependent: `const user = await getUser(); await updateUser(user);`
- Parallel when independent: `Promise.all([fetch1(), fetch2()])`

**Error Handling:**
- Always wrapped in try-catch
- Async operations in API routes return HTTP errors
- Async operations in services throw or return null

**Background Jobs:**
- Fire-and-forget with `.catch()`:
  ```typescript
  invoiceWorkflowService.processDealWon(deal.id).catch((error) => {
    console.error("Failed:", error);
  });
  ```

## Validation

**Framework:** Zod (`zod` package)

**Usage Pattern:**
```typescript
import { z } from "zod";

const chatRequestSchema = z.object({
  leadId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

// In handler
const { leadId, conversationId, message } = chatRequestSchema.parse(body);
```

**Error Handling:**
```typescript
catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.errors },
      { status: 400 }
    );
  }
}
```

**Where Used:**
- API route input validation
- Webhook payload validation
- User input sanitization

## Database Access

**ORM:** Prisma Client

**Singleton Pattern:**
```typescript
// lib/db.ts
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
```

**Query Patterns:**
- Use `select` for optimized queries (only needed fields)
- Use `include` for relations
- Prefer `findUnique` over `findFirst` when possible (performance)
- Transaction support via `prisma.$transaction()` when needed

**Error Handling:**
- Prisma errors caught and logged
- No database errors exposed to API responses (return generic 500)

## Resilience Patterns

**Circuit Breaker:**
- Implemented in `lib/utils/circuit-breaker.ts`
- Used for external API calls (OpenAI)
- Pattern:
  ```typescript
  private circuitBreaker: CircuitBreaker;
  
  constructor() {
    this.circuitBreaker = new CircuitBreaker("openai");
  }
  
  const result = await this.circuitBreaker.execute(async () => {
    // API call
  });
  ```

**Retry Logic:**
- Implemented in `lib/utils/retry-logic.ts`
- Used with `p-retry` package
- Exponential backoff for transient failures

**Queue-Based Processing:**
- BullMQ for async job processing
- Defined in `lib/utils/queue.ts`
- Webhooks enqueued for async processing

---

*Convention analysis: 2026-01-27*
