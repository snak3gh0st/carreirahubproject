# Fix Remaining Dynamic Route Configurations

## Issue
During investigation of quickbooks-invoice-sending-failure, discovered 20+ API routes missing `export const dynamic = "force-dynamic"` configuration.

## Background
Next.js 14 App Router tries to statically render routes at build time by default. Routes that use `getServerSession(authOptions)` call the `headers()` API, which is only available at request time (dynamic). Without the `export const dynamic = "force-dynamic"` configuration, these routes fail with:

```
Error: Dynamic server usage: Route /api/xxx couldn't be rendered statically because it used `headers`.
```

## Already Fixed (Invoice-Critical Routes)
- ✅ /api/debug/verbose-qb-send
- ✅ /api/debug/test-qb-email  
- ✅ /api/debug/check-qb-email-status
- ✅ /api/invoices/create
- ✅ /api/invoices/[id]
- ✅ /api/invoices/delete

## Still Need Fixing
Run this command to find remaining affected routes:

```bash
find app/api -name "route.ts" -type f -exec sh -c 'if grep -q "getServerSession" "$1" && ! grep -q "export const dynamic" "$1"; then echo "$1"; fi' _ {} \;
```

Known affected routes (as of 2026-01-30):
- /api/customers/delete/route.ts
- /api/docusign/templates/route.ts
- /api/auth/set-password/route.ts
- /api/contracts/route.ts
- /api/contracts/[id]/download/route.ts
- /api/contracts/[id]/route.ts
- /api/contracts/[id]/resend/route.ts
- /api/quickbooks/payments/route.ts
- /api/quickbooks/test/route.ts
- /api/quickbooks/info/route.ts
- /api/quickbooks/sync/customers/route.ts
- /api/quickbooks/sync/invoices/route.ts
- /api/quickbooks/sync/route.ts
- /api/quickbooks/analytics/route.ts
- /api/integrations/pipedrive/sync/deal/[id]/route.ts
- /api/integrations/pipedrive/sync/customer/[id]/route.ts
- /api/integrations/bulk-import/pipedrive/route.ts
- /api/integrations/bulk-import/quickbooks/route.ts
- /api/integrations/bulk-import/[id]/route.ts
- /api/integrations/sync-status/route.ts
- /api/integrations/circuit-status/route.ts
- /api/integrations/hub-status/route.ts
- /api/dashboard/alerts/route.ts
- /api/dashboard/alerts/[alertId]/route.ts
- /api/dashboard/metrics/route.ts
- /api/search/route.ts
- /api/analytics/bi-dashboard/route.ts
- /api/analytics/comprehensive-dashboard/route.ts
- /api/analytics/dashboard/route.ts
- /api/analytics/financial/route.ts
- /api/webhooks/dead-letter/route.ts
- /api/webhooks/reprocess/[id]/route.ts
- /api/users/route.ts
- /api/invoices/[id]/collection-call/route.ts
- /api/invoices/[id]/send-payment-link/route.ts
- /api/invoices/[id]/resend-contract/route.ts

## Fix Template

Add this line after imports in each affected file:

```typescript
export const dynamic = "force-dynamic";
```

Example:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic"; // ← ADD THIS

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  // ... rest of code
}
```

## Priority
- **P1 (High)**: Contract, customer, QuickBooks sync routes (business critical)
- **P2 (Medium)**: Integration, dashboard, analytics routes
- **P3 (Low)**: Debug, webhook reprocess routes

## Verification
After fixing each batch:
1. Run `npm run build` - should complete without "Dynamic server usage" errors for fixed routes
2. Test routes in dev mode - should return proper responses (401 if not authed, 200 if authed)

## Related
- Debug session: .planning/debug/resolved/quickbooks-invoice-sending-failure.md
- Commit: a090fb2 (initial invoice/debug fixes)
