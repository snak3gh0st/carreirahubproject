# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- None detected (no Jest, Vitest, or other test runner configured)

**Assertion Library:**
- Not applicable (no test files found)

**Run Commands:**
```bash
# No test commands configured
# package.json has no "test" script
```

**Status:** No automated testing infrastructure currently in place.

## Test File Organization

**Location:**
- No `*.test.ts` or `*.spec.ts` files found in codebase
- No `__tests__` directories detected

**Testing Strategy:**
- Manual testing via scripts in `scripts/` directory
- Integration testing via live API calls

## Manual Testing Scripts

**Location:** `scripts/` directory (39 TypeScript scripts)

**Key Testing Scripts:**

**`test-quickbooks.ts`** (342 lines):
- Integration test for QuickBooks API
- Tests: Connection, Company Info, Customers, Invoices, Items, Payments, Full Sync
- Pattern: Sequential test execution with result tracking
```typescript
interface TestResult {
  name: string;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}
```

**`test-invoice-workflow.ts`:**
- Tests invoice generation workflow
- Validates Deal Won → Invoice creation flow

**`test-docusign.ts`:**
- Tests DocuSign integration
- Contract generation and signing flow

**`test-user-login.ts`:**
- Tests authentication flow
- Validates bcrypt password verification

**Execution Pattern:**
```bash
npm run test:quickbooks  # Run QuickBooks integration test
npm run test:workflow    # Test invoice workflow
npm run test:docusign    # Test DocuSign integration
npm run user:test-login  # Test user authentication
```

## Testing Patterns (from Scripts)

**Structure:**
```typescript
async function testIntegration(): Promise<void> {
  console.log("🧪 Starting tests...\n");
  const results: TestResult[] = [];
  
  // Test 1: Configuration
  try {
    // Test logic
    results.push({ name: "Test Name", success: true });
  } catch (error) {
    results.push({ name: "Test Name", success: false, error: error.message });
  }
  
  // Summary
  const passed = results.filter(r => r.success).length;
  console.log(`📈 Result: ${passed}/${results.length} tests passed`);
  
  process.exit(passed === results.length ? 0 : 1);
}
```

**Assertions:**
- Manual boolean checks
- Success/failure tracked in result objects
- No assertion library (uses native conditionals)

## Testing Approach

**Integration Testing:**
- Live API calls to external services
- Real database connections (Neon PostgreSQL)
- Environment variable dependent

**Test Data:**
```bash
npm run db:seed          # Seed test data
npm run db:clear         # Clear all data
npm run user:create      # Create test user
```

**Manual Verification:**
- Console logging with emojis for visibility (✓, ✗, 🧪, 📊)
- Timing measurements included - e.g., `duration: ${duration}ms`
- Sample data output for inspection

## Error Testing

**Pattern:**
```typescript
try {
  const result = await service.operation();
  console.log(`   ✓ Success:`, result);
} catch (error: any) {
  console.log(`   ✗ Error: ${error.message}`);
  // Continue testing (don't fail fast)
}
```

**Error Handling:**
- All errors caught and logged
- Tests continue even after failures
- Final summary shows pass/fail count

## Mocking

**Framework:** None (no mocking library detected)

**Approach:**
- No mocking used in current testing strategy
- Tests run against real services and database
- API keys required for tests to pass

**Configuration Checks:**
```typescript
const hasClientId = !!process.env.QUICKBOOKS_CLIENT_ID;
const hasAccessToken = !!process.env.QUICKBOOKS_ACCESS_TOKEN;

if (!hasAccessToken) {
  console.warn("⚠️  Configuration incomplete. Some tests may fail.");
}
```

## Coverage

**Requirements:** None enforced

**View Coverage:**
- Not applicable (no coverage tooling)

**Current Status:**
- No code coverage metrics available
- Manual testing covers critical paths only
- Focus on integration testing over unit testing

## Test Types

**Unit Tests:**
- Not implemented
- No isolated function testing

**Integration Tests:**
- Primary testing strategy
- Scripts test full workflows end-to-end
- External API integration validated

**E2E Tests:**
- Not implemented
- No browser automation (Playwright, Cypress, etc.)

## Common Patterns

**Async Testing:**
```typescript
async function testOperation(): Promise<void> {
  const startTime = Date.now();
  
  try {
    const result = await service.operation();
    const duration = Date.now() - startTime;
    
    console.log(`   ✓ Operation succeeded (${duration}ms)`);
  } catch (error) {
    console.log(`   ✗ Operation failed:`, error.message);
  }
}
```

**Sequential Testing:**
```typescript
// Test 1
await test1();

// Test 2 (depends on Test 1)
await test2();

// Test 3
await test3();
```

**Result Aggregation:**
```typescript
const results: TestResult[] = [];

// Run tests
results.push(await runTest1());
results.push(await runTest2());

// Summary
const passed = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;

console.log(`📊 SUMMARY: ${passed}/${results.length} passed`);
```

## Development Testing Tools

**Database Utilities:**
```bash
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:views         # Create analytical views
npm run db:seed          # Seed test data
npm run db:clear         # Clear all data (destructive)
```

**User Management:**
```bash
npm run user:create      # Create test user
npm run user:delete      # Delete user
npm run user:list        # List all users
npm run user:password    # Update password
```

**Integration Debugging:**
```bash
npm run test:quickbooks  # Test QuickBooks API
npm run test:workflow    # Test invoice workflow
npm run test:docusign    # Test DocuSign API
```

## Testing Recommendations

**Gaps Identified:**
1. No unit test infrastructure (Jest/Vitest needed)
2. No automated test suite for CI/CD
3. No mocking for external API calls
4. No test coverage metrics
5. No component testing (React Testing Library)
6. No E2E browser testing

**Current Strengths:**
1. Comprehensive integration test scripts
2. Clear test output with timing
3. Real-world API validation
4. Database seeding utilities
5. Manual test documentation via script names

**Best Practice for Adding Tests:**

Given the service-oriented architecture, recommended approach:

1. **Unit Tests (Priority):**
   - Test pure functions in `lib/utils/` (e.g., `hmac.ts`, `invoice-number.ts`)
   - Test business logic in services (mock Prisma/external APIs)
   - Use Jest or Vitest

2. **Integration Tests (Keep Current Approach):**
   - Continue using scripts for full workflow validation
   - Add to CI/CD as smoke tests

3. **API Route Tests:**
   - Use `@next/test-utils` or similar
   - Mock external services but use real database (test env)

4. **Component Tests:**
   - React Testing Library for UI components
   - Test user interactions, not implementation

---

*Testing analysis: 2026-01-27*

**Note:** This codebase currently uses a **manual integration testing strategy** via scripts. While effective for validating external integrations, adding automated unit and component tests would improve development velocity and catch regressions earlier.
