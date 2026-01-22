---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/invoice-number.ts
  - app/api/invoices/create/route.ts
autonomous: true

must_haves:
  truths:
    - "Invoice numbers use customer initials (PM not PHIL)"
    - "All roles auto-sync invoices to QuickBooks immediately"
    - "All roles send invoice emails automatically"
    - "No draft/approval workflow exists"
  artifacts:
    - path: "lib/utils/invoice-number.ts"
      provides: "Initials-based customer code generation"
      contains: "split.*map.*charAt"
    - path: "app/api/invoices/create/route.ts"
      provides: "Role-agnostic auto-sync behavior"
      missing: "needsApproval"
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "lib/utils/invoice-number.ts"
      via: "generateInvoiceNumber import"
      pattern: "generateInvoiceNumber"
---

<objective>
Update invoice numbering to use customer initials and remove approval workflow so all roles auto-sync to QuickBooks.

Purpose: Simplify invoice numbers (PM-2026-01-001 instead of PHIL-2026-01-001) and eliminate draft/approval workflow for SALES role.
Output: All invoices immediately sync to QB and send emails regardless of user role.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/utils/invoice-number.ts
@app/api/invoices/create/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update generateCustomerCode to use initials</name>
  <files>lib/utils/invoice-number.ts</files>
  <action>
Modify generateCustomerCode() function to extract initials from customer name:

1. Split name by spaces/hyphens
2. Take first character of each word
3. Uppercase and join
4. Fallback to "X" for empty/invalid names

Examples:
- "Philipe Melo" -> "PM"
- "Carreira USA" -> "CU"
- "John" -> "J" (single name)
- "Mary Jane Watson" -> "MJW"
- "" -> "X" (fallback)

Update function comment/doc to reflect new behavior.

Also update parseInvoiceNumber regex to accept variable length codes (1-4 chars instead of exactly 3-4).
  </action>
  <verify>
Create quick test in node REPL:
```
const { generateCustomerCode } = require('./lib/utils/invoice-number');
console.log(generateCustomerCode("Philipe Melo")); // PM
console.log(generateCustomerCode("Carreira USA")); // CU
console.log(generateCustomerCode("John")); // J
console.log(generateCustomerCode("")); // X
```
  </verify>
  <done>generateCustomerCode returns initials, not first 4 letters</done>
</task>

<task type="auto">
  <name>Task 2: Remove approval workflow - all roles auto-sync</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Remove role-based approval workflow:

1. Delete line 70: `const needsApproval = role === "SALES";`
2. Delete line 71: `const isFinanceOrAdmin = role === "FINANCE" || role === "ADMIN" || role === "COMMERCIAL";`
3. Remove the conditional `if (needsApproval)` block (lines 136-139) - this was just a comment placeholder anyway
4. Remove `needsApproval` ternary conditions in invoice creation (lines 255-258):
   - `status: needsApproval ? InvoiceStatus.DRAFT : InvoiceStatus.SENT` -> `status: InvoiceStatus.SENT`
   - `approvalStatus: needsApproval ? "PENDING" : "APPROVED"` -> `approvalStatus: "APPROVED"`
   - `approvedBy: needsApproval ? undefined : userId` -> `approvedBy: userId`
   - `approvedAt: needsApproval ? undefined : new Date()` -> `approvedAt: new Date()`

Result: All invoices immediately:
- Sync to QuickBooks
- Send email to customer
- Have status SENT (not DRAFT)
- Have approvalStatus APPROVED
  </action>
  <verify>
Read the modified file and confirm:
- No references to `needsApproval` variable
- No references to `isFinanceOrAdmin` variable
- All invoices get status: InvoiceStatus.SENT
- All invoices get approvalStatus: "APPROVED"
  </verify>
  <done>SALES role creates invoices that auto-sync to QB and send emails like FINANCE/ADMIN</done>
</task>

</tasks>

<verification>
1. `npm run build` passes without TypeScript errors
2. Invoice number format confirmed: generateCustomerCode("Philipe Melo") returns "PM"
3. No `needsApproval` variable in create route
</verification>

<success_criteria>
- Invoice numbers use initials (PM-2026-01-001 not PHIL-2026-01-001)
- All user roles auto-sync invoices to QuickBooks
- All user roles send invoice emails automatically
- No draft/pending approval status for any role
</success_criteria>

<output>
After completion, create `.planning/quick/005-initials-and-auto-send/005-SUMMARY.md`
</output>
