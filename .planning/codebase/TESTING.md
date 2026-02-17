# Testing Patterns

**Analysis Date:** 2026-02-17

## Test Framework

**Runner:**
- No test framework is installed (no Jest, Vitest, Mocha, or similar in `package.json`)
- No test configuration files exist (`jest.config.*`, `vitest.config.*`)
- No test files exist in the source code (no `*.test.ts`, `*.spec.ts` outside `node_modules/`)

**Assertion Library:**
- None installed

**Run Commands:**
```bash
# No automated test commands exist
# The following scripts are manual integration/smoke tests, NOT automated test suites:
npm run test:quickbooks        # Manual QuickBooks API integration test (scripts/test-quickbooks.ts)
npm run test:pipedrive         # Manual Pipedrive API test (scripts/test-pipedrive.ts)
npm run test:workflow          # Manual invoice workflow test (scripts/test-invoice-workflow.ts)
npm run test:docusign          # Manual DocuSign test (scripts/test-docusign.ts)
npm run test:docusign-prod     # Manual DocuSign production test (scripts/test-docusign-prod.ts)
npm run test:system            # Comprehensive system smoke test (scripts/test-system-comprehensive.ts)
npm run test:system:api        # API-only subset of system test
```

## Test File Organization

**Location:**
- No co-located or separate test files exist in the project source
- All "test" scripts live in `scripts/` directory and are manual integration verifiers

**Naming:**
- Script naming pattern: `test-[integration-name].ts` (e.g., `scripts/test-quickbooks.ts`)
- Debug/diagnostic scripts: `check-*.ts`, `debug-*.ts`, `diagnose-*.ts`, `verify-*.ts`

**Structure:**
```
scripts/
  test-quickbooks.ts          # QuickBooks API connectivity + CRUD test
  test-pipedrive.ts           # Pipedrive API test
  test-invoice-workflow.ts    # Invoice creation workflow test
  test-docusign.ts            # DocuSign sandbox test
  test-docusign-prod.ts       # DocuSign production test
  test-system-comprehensive.ts # Full system smoke test (files + TypeScript + API)
  test-forecast.ts            # Forecast calculation test
  test-invoice-email.ts       # Invoice email sending test
  test-installment-dates.ts   # Installment date calculation test
  test-pricelevel.ts          # QuickBooks price level test
  test-admin-login.ts         # Admin login flow test
  test-user-login.ts          # User login flow test
  test-customer-creation-fix.ts # Customer creation regression test
  test-invoice-number-length.ts # Invoice number format test
  check-*.ts                  # ~10 diagnostic scripts for DB state inspection
  debug-*.ts                  # ~5 debugging scripts
  diagnose-*.ts               # ~3 diagnostic scripts
  verify-*.ts                 # ~5 verification scripts
```

## Test Structure

**Manual Integration Test Pattern:**
```typescript
// scripts/test-quickbooks.ts
import { quickbooksService } from "../lib/services/quickbooks.service";

interface TestResult {
  name: string;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

async function testQuickBooksIntegration(): Promise<void> {
  console.log("Starting QuickBooks integration tests...\n");

  const results: TestResult[] = [];

  // Test 1: Configuration check
  console.log("\n1. Checking configuration...");
  const configTest: TestResult = { name: "Configuration", success: false };
  try {
    // ... verify env vars exist
    configTest.success = true;
  } catch (error: any) {
    configTest.error = error.message;
  }
  results.push(configTest);

  // Test 2: API connectivity
  console.log("\n2. Testing connection...");
  // ... similar pattern

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS:");
  results.forEach((r) => {
    console.log(`  ${r.success ? "PASS" : "FAIL"} ${r.name}`);
  });
}

testQuickBooksIntegration().catch(console.error);
```

**System Smoke Test Pattern (`scripts/test-system-comprehensive.ts`):**
```typescript
// Tests 4 categories:
// 1. Component file existence (checks files exist + contain expected exports)
// 2. TypeScript compilation (runs tsc --noEmit)
// 3. API endpoint functionality (HTTP requests to running server)
// 4. Integration flow validation

// Uses file system checks (readFileSync + regex) instead of test framework
function addResult(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
}

// File existence checks use regex pattern matching:
const checks = [
  { name: "QuickFilters export", pattern: /export function QuickFilters/ },
  { name: "DATE_RANGES constant", pattern: /const DATE_RANGES/ },
];

// Run with: npx tsx scripts/test-system-comprehensive.ts
```

**Patterns:**
- All tests use `console.log` for output with emoji indicators
- Test results collected in `TestResult[]` array
- Summary printed at end with pass/fail counts
- Tests run against LIVE services (require real API credentials and running database)
- No mocking framework or test doubles are used
- Scripts are excluded from TypeScript compilation (`tsconfig.json` excludes `scripts/`)
- Scripts run via `npx tsx` (TypeScript execution without compilation)

## Mocking

**Framework:** None

**What is mocked:** Nothing. All test scripts hit real external APIs.

**Implication:** Tests require:
- Valid environment variables / API credentials
- Running database connection
- Network access to external services (QuickBooks, Pipedrive, etc.)
- For API endpoint tests: a running dev server (`npm run dev`)

## Fixtures and Factories

**Test Data:**
```bash
npm run db:seed    # Seeds database with test data (scripts/seed-test-data.js)
npm run db:clear   # Clears all database data
npm run user:create # Creates test user for development
```

**Location:**
- Seed script: `scripts/seed-test-data.js` (JavaScript, not TypeScript)
- User management: `scripts/manage-users-with-password.ts`
- No factory pattern or fixture files exist

## Coverage

**Requirements:** None enforced. No coverage tooling is configured.

**View Coverage:** Not available.

## Test Types

**Unit Tests:**
- Do not exist. No unit test files or framework.

**Integration Tests:**
- Manual scripts in `scripts/` that test service-to-external-API integration
- Require real credentials and live services
- Run on-demand by developer, not in CI/CD

**E2E Tests:**
- Not used. No Cypress, Playwright, or similar framework.

**System Smoke Tests:**
- `scripts/test-system-comprehensive.ts` checks file existence, TypeScript compilation, and API responses
- Closest thing to an automated test suite, but not run in CI/CD

## Build-Time Validation

**What serves as testing:**
- TypeScript strict mode catches type errors at build time
- ESLint catches code quality issues: `npm run lint`
- `next build` (via `npm run build`) validates the entire application compiles
- `next.config.js` has `ignoreBuildErrors: false` and `ignoreDuringBuilds: false` for both TypeScript and ESLint

```bash
npm run build    # Runs prisma generate && next build (catches type + lint errors)
npm run lint     # ESLint check only
```

## Common Patterns

**Async Operations:**
- All service methods are `async` and return `Promise<T>`
- API routes use `try/catch` around all async operations
- External API calls use circuit breaker pattern for resilience

**Error Testing (manual):**
- Diagnostic scripts check error states: `scripts/check-invoice-error.ts`, `scripts/debug-invoice-errors.ts`
- These query the `IntegrationLog` table for recent errors
- Pattern: `prisma.integrationLog.findMany({ where: { status: "ERROR" } })`

## Recommendations for Adding Tests

When introducing automated testing to this codebase:

**Suggested Framework:**
- Vitest (fast, TypeScript-native, compatible with Next.js)
- Config would go in `vitest.config.ts` at project root

**Priority test targets:**
1. `lib/services/identity-mapper.ts` - Critical deduplication logic
2. `lib/services/lead.service.ts` - Lead lifecycle and qualification threshold
3. `lib/utils/circuit-breaker.ts` - State machine transitions
4. `lib/utils/error-fallback.ts` - Error categorization logic
5. `lib/utils/logger.ts` - Structured error detection
6. API route validation (Zod schema tests)

**Test file placement:**
- Co-locate with source: `lib/services/lead.service.test.ts`
- Or separate directory: `__tests__/services/lead.service.test.ts`

**Mocking approach:**
- Mock `prisma` client for service unit tests
- Mock external API clients (Stripe, QuickBooks) for integration service tests
- Use real Prisma with test database for integration tests

---

*Testing analysis: 2026-02-17*
