---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/utils/invoice-number.ts
  - lib/services/quickbooks.service.ts
  - app/api/invoices/create/route.ts
autonomous: true

must_haves:
  truths:
    - "Invoice numbers include customer identifier (3-4 chars from name)"
    - "Invoice numbers include date component (YYYY-MM format)"
    - "Invoice numbers include installment sequence (001, 002, etc.)"
    - "Invoice numbers are deterministic and unique per customer/month"
    - "QuickBooks accepts and stores custom DocNumber"
    - "Draft invoices get same number format (will transfer to QB on approval)"
  artifacts:
    - path: "lib/utils/invoice-number.ts"
      provides: "Invoice number generation utility"
      exports: ["generateInvoiceNumber", "parseInvoiceNumber"]
      min_lines: 40
  key_links:
    - from: "app/api/invoices/create/route.ts"
      to: "lib/utils/invoice-number.ts"
      via: "import generateInvoiceNumber"
      pattern: "generateInvoiceNumber"
    - from: "lib/services/quickbooks.service.ts"
      to: "QuickBooks API"
      via: "DocNumber field in invoice payload"
      pattern: "DocNumber"
---

<objective>
Implement professional invoice numbering system with customer identification, date, and installment tracking.

Purpose: Replace generic `DRAFT-{timestamp}-{i}` and QB auto-generated numbers with professional, accountant-friendly invoice numbers that include customer context and installment tracking.

Output: Invoice number generator utility and integration with invoice creation flow.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@lib/services/quickbooks.service.ts (createInvoice method)
@app/api/invoices/create/route.ts (invoice creation flow)
@prisma/schema.prisma (Invoice model)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create invoice number generator utility</name>
  <files>lib/utils/invoice-number.ts</files>
  <action>
Create a new utility file that generates professional invoice numbers.

**Format:** `{CUSTOMER}-{YYYY-MM}-{SEQ}`
- CUSTOMER: First 3-4 characters of customer name, uppercase, alphanumeric only
- YYYY-MM: Year and month of invoice creation
- SEQ: 3-digit sequence number (001, 002, 003...)

**Implementation:**

```typescript
/**
 * Invoice Number Generator
 *
 * Format: CUST-YYYY-MM-001
 * Examples:
 *   - "CAR-2026-01-001" (Carreira USA, January 2026, first invoice)
 *   - "JOHN-2026-01-002" (John Doe, January 2026, second invoice)
 *   - "SMIT-2026-02-001" (Smith LLC, February 2026, first invoice)
 */

export interface InvoiceNumberOptions {
  customerName: string;
  date?: Date;
  sequence: number; // 1-based sequence within the invoice series
}

export interface ParsedInvoiceNumber {
  customerCode: string;
  year: number;
  month: number;
  sequence: number;
}

/**
 * Generate customer code from name
 * Takes first 4 alphanumeric characters, uppercase
 * Falls back to "CUST" if name is empty or has no valid chars
 */
export function generateCustomerCode(name: string): string {
  // Remove non-alphanumeric, take first 4 chars, uppercase
  const code = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();

  return code.length >= 3 ? code : 'CUST';
}

/**
 * Generate professional invoice number
 */
export function generateInvoiceNumber(options: InvoiceNumberOptions): string {
  const { customerName, date = new Date(), sequence } = options;

  const customerCode = generateCustomerCode(customerName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');

  return `${customerCode}-${year}-${month}-${seq}`;
}

/**
 * Parse invoice number back to components
 * Returns null if format is invalid
 */
export function parseInvoiceNumber(invoiceNumber: string): ParsedInvoiceNumber | null {
  // Pattern: XXXX-YYYY-MM-NNN
  const match = invoiceNumber.match(/^([A-Z0-9]{3,4})-(\d{4})-(\d{2})-(\d{3})$/);

  if (!match) return null;

  return {
    customerCode: match[1],
    year: parseInt(match[2], 10),
    month: parseInt(match[3], 10),
    sequence: parseInt(match[4], 10),
  };
}

/**
 * Check if string is a valid professional invoice number format
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return parseInvoiceNumber(invoiceNumber) !== null;
}
```

**Key decisions:**
- Use 4 chars max for customer code (handles short names like "Ana" with 3 chars)
- YYYY-MM format for date (monthly grouping, easier to read than YYYYMMDD)
- 3-digit sequence (supports up to 999 invoices per customer per month)
- Alphanumeric customer code (safe for QB, no special chars)
  </action>
  <verify>
Run TypeScript compilation to verify no errors:
```bash
npx tsc lib/utils/invoice-number.ts --noEmit --skipLibCheck
```
  </verify>
  <done>
Invoice number utility exists with generateInvoiceNumber, parseInvoiceNumber, generateCustomerCode, and isValidInvoiceNumber functions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update QuickBooks service to accept custom DocNumber</name>
  <files>lib/services/quickbooks.service.ts</files>
  <action>
Modify the `createInvoice` method to accept and send custom DocNumber to QuickBooks.

**Changes to createInvoice method:**

1. Add optional `docNumber` parameter to the method signature
2. Include DocNumber in the invoice payload sent to QB API
3. QB API accepts DocNumber field for custom invoice numbers

**Update the method signature and payload:**

```typescript
async createInvoice(data: {
  customerId: string;
  dueDate?: Date;
  docNumber?: string;  // ADD: Custom invoice number
  lineItems: Array<{
    description: string;
    amount: number;
    itemRef?: string;
  }>;
}): Promise<any> {
  const invoiceData = {
    CustomerRef: {
      value: data.customerId,
    },
    DocNumber: data.docNumber,  // ADD: Include custom invoice number
    TxnDate: new Date().toISOString().split("T")[0],
    DueDate: data.dueDate
      ? data.dueDate.toISOString().split("T")[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
    Line: data.lineItems.map((item) => ({
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: item.itemRef || "1",
        },
      },
      Description: item.description,
    })),
  };

  const result = await this.request("/invoice", {
    method: "POST",
    body: JSON.stringify(invoiceData),
  });

  return result.Invoice;
}
```

**Note:** QuickBooks accepts DocNumber as optional. If provided, QB will use it instead of auto-generating. If the number already exists in QB, the API will return an error (which is correct - prevents duplicates).
  </action>
  <verify>
Verify the method signature change compiles:
```bash
npx tsc lib/services/quickbooks.service.ts --noEmit --skipLibCheck
```
  </verify>
  <done>
createInvoice method accepts docNumber parameter and includes DocNumber in QB API payload.
  </done>
</task>

<task type="auto">
  <name>Task 3: Integrate invoice number generator in create route</name>
  <files>app/api/invoices/create/route.ts</files>
  <action>
Update the invoice creation route to use the new invoice number generator.

**Changes:**

1. Import the invoice number generator
2. Generate professional invoice number using customer name and sequence
3. Pass docNumber to QuickBooks API
4. Use same number format for draft invoices (consistency)

**Key implementation points:**

```typescript
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";

// Inside the POST handler, in the loop that creates invoices:

// Calculate sequence based on installment position
// For entry + installments: entry is 001, installment 1 is 002, etc.
// For just installments: installment 1 is 001, installment 2 is 002, etc.
// For single invoice: sequence is 001
const sequence = i; // i is already 1-based in the loop

// Generate professional invoice number
const invoiceNumber = generateInvoiceNumber({
  customerName: customer.name,
  date: invoiceDueDate,
  sequence,
});

// For QuickBooks path (auto-approved):
const qbInvoiceData: any = {
  customerId: qbCustomer.Id,
  dueDate: invoiceDueDate,
  docNumber: invoiceNumber,  // ADD: Custom invoice number
  lineItems: [{
    description: invoiceDescription,
    amount: invoiceAmount,
    itemRef: data.serviceItemId,
  }],
};

// For draft path (pending approval):
// Use same invoiceNumber variable (already generated above)
// Remove the `DRAFT-${timestamp}-${i}` pattern
```

**Important:** The sequence number represents the installment position within the series (1, 2, 3...). This is different from a global counter - each customer gets their own sequence per invoice batch.

**Handling existing draft invoices:** This change only affects NEW invoices. Existing drafts with `DRAFT-*` numbers will keep their numbers until they go through approval (where QB assigns final number or we could update to new format).
  </action>
  <verify>
1. Run TypeScript check:
```bash
npx tsc app/api/invoices/create/route.ts --noEmit --skipLibCheck
```

2. Test invoice creation manually:
```bash
# Start dev server if not running
npm run dev

# Create test invoice via API (use valid customer/service IDs from your DB)
curl -X POST http://localhost:3000/api/invoices/create \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "customerId": "<valid-customer-id>",
    "serviceItemId": "<valid-service-item-id>",
    "unitPrice": 100,
    "quantity": 1,
    "description": "Test invoice"
  }'
```

Check that returned invoiceNumber follows format: XXXX-YYYY-MM-001
  </verify>
  <done>
Invoice creation route generates professional invoice numbers using customer name, date, and sequence. Both draft and QB-synced invoices use consistent numbering format.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. **Format validation:**
   - New invoices have numbers like "CARR-2026-01-001"
   - Numbers include customer identifier, date, and sequence

2. **QuickBooks sync:**
   - QB invoices show custom DocNumber (not auto-generated)
   - No duplicate number errors in QB

3. **Installment tracking:**
   - Multi-installment invoices have sequential numbers: 001, 002, 003...
   - Entry payments and installments are distinguishable by sequence

4. **Database consistency:**
   - Invoice.invoiceNumber field populated with professional format
   - No more DRAFT-timestamp patterns for new invoices
</verification>

<success_criteria>
- [ ] lib/utils/invoice-number.ts created with generator functions
- [ ] QuickBooks service accepts and sends custom DocNumber
- [ ] Invoice create route generates professional numbers
- [ ] Format: {CUSTOMER_CODE}-{YYYY}-{MM}-{SEQ}
- [ ] Installments numbered sequentially (001, 002, 003...)
- [ ] TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/004-custom-invoice-numbers/004-SUMMARY.md`
</output>
