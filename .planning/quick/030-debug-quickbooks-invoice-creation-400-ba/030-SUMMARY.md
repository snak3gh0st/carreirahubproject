# Quick Task 030: Debug QuickBooks Invoice Creation 400 Bad Request

## Objective
Fix QuickBooks API 400 Bad Request error preventing invoice creation

## Root Cause
Customer creation was failing due to invalid `BillAddr.City` field. The fallback value was set to "USA" (a country), but QuickBooks validates that City must be a valid city name.

## Solution
Changed fallback `BillAddr` structure in `lib/services/quickbooks.service.ts`:

**Before:**
```javascript
BillAddr: {
  City: "USA",  // ❌ Invalid - country, not city
  Country: "USA",
  Line1: "Billing Address"
}
```

**After:**
```javascript
BillAddr: {
  Line1: "Not Provided",
  City: "Not Provided",  // ✅ Valid placeholder
  Country: "USA"
}
```

## Files Changed
- `lib/services/quickbooks.service.ts` - Fixed BillAddr fallback (line 375)
- `scripts/test-customer-creation-fix.ts` - Verification test
- `scripts/debug-qb-errors.ts` - Diagnostic tool
- `scripts/debug-invoice-errors.ts` - Diagnostic tool

## Verification
✅ Created test customer with no address (QB ID: 1495)
✅ QuickBooks accepted payload without errors
✅ Customer updates working: "Cliente Raquel Rodrigues atualizado com sucesso!"

## Commit
`ed9ad65` - fix: correct QuickBooks BillAddr fallback city value

## Impact
- Customers with missing address data can now be created/updated in QuickBooks
- Invoice creation workflow unblocked
- No breaking changes to existing functionality

## Duration
~12 minutes (investigation + fix + verification)
