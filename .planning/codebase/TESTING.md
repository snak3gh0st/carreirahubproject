# Testing Patterns

**Analysis Date:** 2026-01-09

## Test Framework

**Runner:**
- Not detected - No test framework configured
- No `jest.config.js`, `vitest.config.ts`, or similar found

**Assertion Library:**
- Not applicable - No tests found

**Run Commands:**
```bash
# Not configured yet
npm test                              # Would run tests (currently no-op)
npm run test:quickbooks              # Manual integration test script
```

## Test File Organization

**Location:**
- Not established - No test files detected in codebase
- Tests should follow pattern: co-located with source files

**Naming:**
- Recommended: `*.test.ts` or `*.spec.ts` alongside source
- Example: `lib/services/lead.service.test.ts`

**Structure:**
- Recommended pattern not yet established
- Consider: src/services/ → src/services/*.test.ts

## Test Structure

**Suite Organization (Recommended for future):**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("LeadService", () => {
  describe("createLead", () => {
    it("should create a new lead with valid data", () => {
      // arrange
      // act
      // assert
    });

    it("should throw on missing email", () => {
      // test
    });
  });
});
```

**Patterns:**
- Use beforeEach/afterEach for setup/teardown
- Arrange/Act/Assert comments recommended
- One assertion focus per test (multiple expects OK)

## Mocking

**Framework:**
- Not configured - Would use Vitest `vi` or Jest mocking when implemented

**Patterns (Recommended):**
```typescript
// Mock database
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock external service
vi.mock("@/lib/services/ai.service", () => ({
  aiService: {
    qualifyLead: vi.fn(),
  },
}));
```

**What to Mock:**
- Database operations (Prisma)
- External API calls (Pipedrive, QuickBooks, Stripe, OpenAI)
- Third-party services (Resend, Twilio, DocuSign)

**What NOT to Mock:**
- Business logic in services
- Utility functions
- Error handling code

## Fixtures and Factories

**Test Data (Recommended):**
```typescript
// Factory function
function createTestLead(overrides?: Partial<Lead>): Lead {
  return {
    id: "lead-123",
    email: "test@example.com",
    name: "Test Lead",
    status: LeadStatus.NEW,
    ...overrides,
  };
}

// Fixture file
// scripts/fixtures/test-leads.ts
export const mockLeads = [
  createTestLead({ status: LeadStatus.QUALIFIED }),
  createTestLead({ status: LeadStatus.UNQUALIFIED }),
];
```

**Location (Recommended):**
- Factory functions in test files
- Shared fixtures in `scripts/fixtures/` or `tests/fixtures/`

## Coverage

**Requirements:**
- Not enforced - No coverage target configured
- Recommended: Start with 70%+ for critical paths

**Configuration:**
- Would use Vitest or Jest coverage plugin when configured

**View Coverage (Recommended):**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests (Recommended):**
- Test single function/service in isolation
- Mock all external dependencies
- Fast execution (<100ms per test)
- Examples: service methods, utility functions

**Integration Tests (Recommended):**
- Test multiple modules together
- Mock external services (APIs), use real database
- Examples: webhook handlers, service workflows

**E2E Tests:**
- Not currently implemented
- Could use Playwright for browser automation
- Not urgent given API-first architecture

## Manual Integration Testing

**Existing Scripts:**
- `scripts/test-quickbooks.ts` - Tests QuickBooks OAuth and API
- `scripts/test-invoice-workflow.ts` - Tests invoice generation
- Pattern: TypeScript scripts run with `npx ts-node`

**Usage:**
```bash
npm run test:quickbooks              # Run QB integration test
npm run test:invoice                 # Run invoice workflow test
```

## Common Patterns (Future Implementation)

**Async Testing:**
```typescript
it("should fetch lead with async operation", async () => {
  const result = await leadService.getLeadById("123");
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it("should throw on missing lead", () => {
  expect(() => leadService.getLeadById(null)).toThrow("Lead not found");
});

// Async error
it("should reject on database error", async () => {
  await expect(leadService.createLead(invalidData)).rejects.toThrow();
});
```

**Webhook Testing:**
```typescript
it("should validate webhook signature", () => {
  const isValid = validatePipedriveWebhookSignature(
    payload,
    signature,
    secret
  );
  expect(isValid).toBe(true);
});
```

## Missing Test Coverage

**Critical Areas (High Priority):**
- Webhook processing: Pipedrive deal/lead, QuickBooks, Stripe, DocuSign
- Identity Mapper: Customer deduplication across systems
- Invoice workflow: Generation, approval, payment tracking
- Queue processing: BullMQ job handling and retries

**Important Areas (Medium Priority):**
- Lead qualification: AI scoring logic
- API endpoints: Input validation, auth checks
- Service layer: Business logic and state transitions

**Nice-to-Have (Low Priority):**
- Utility functions
- Error handling edge cases
- UI components

---

*Testing analysis: 2026-01-09*
*Implement test framework and patterns before scaling*
