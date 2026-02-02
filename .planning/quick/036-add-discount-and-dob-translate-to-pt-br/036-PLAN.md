---
task_id: "036"
type: quick
description: "Add discount percentage field to invoice creator, add DOB field to customer creator, and translate both forms to Portuguese Brazil"
created: 2026-02-02
---

# Quick Task 036: Add Discount Percentage, DOB Field, and PT-BR Translation

## Objective

Add discount percentage option to invoice form, add date of birth field to customer form, and translate all remaining English labels in both forms to Portuguese Brazil for consistent user experience.

## Context

**Current State:**
- Invoice form has discount field (USD value only) at line 627-639
- Customer form missing DOB field entirely
- Both forms have mixed language labels (some PT-BR, some English)
- Need consistent PT-BR translation across both forms

**Files to Modify:**
- `app/dashboard/invoices/new/InvoiceForm.tsx` - Add discount percentage toggle and translate labels
- `app/dashboard/customers/new/CustomerForm.tsx` - Add DOB field and translate labels
- `app/api/customers/route.ts` - Handle DOB field in customer creation

## Tasks

### Task 1: Add Discount Percentage to Invoice Form

**Files:** `app/dashboard/invoices/new/InvoiceForm.tsx`

**Action:**
1. Add `discountType` state field: `"amount" | "percentage"` (default: "amount")
2. Modify discount input section (lines 627-639):
   - Add toggle buttons for "Valor (USD)" vs "Percentual (%)"
   - Show appropriate input based on selected type
   - Update calculation logic to handle percentage discounts
   - Apply percentage to subtotal before showing final total
3. Translate all remaining English labels to PT-BR:
   - "Phone" (line 214) → "Telefone"
   - "Optional" → "(Opcional)"
   - "Email will be sent to QuickBooks user" → "Email será enviado ao usuário do QuickBooks"
   - Any other English labels found

**Verify:**
```bash
# Check discount percentage calculation works
# Test with 10% discount on $1000 subtotal = $100 discount
# Test with $100 amount discount on $1000 subtotal = $100 discount
```

**Done:** Invoice form has discount percentage option, calculation works correctly, all labels in Portuguese.

### Task 2: Add DOB Field to Customer Form

**Files:** 
- `app/dashboard/customers/new/CustomerForm.tsx`
- `app/api/customers/route.ts`

**Action:**
1. Add `dateOfBirth` field to form state in CustomerForm.tsx
2. Add DOB input field after email field (around line 210):
   - Label: "Data de Nascimento (Opcional)"
   - Input type: "date"
   - Placeholder: "DD/MM/AAAA"
   - Not required (optional field)
3. Include DOB in API payload (line 46-58)
4. Update customer creation API to accept and store `dateOfBirth` field:
   - Parse as Date object
   - Store in Customer.dateOfBirth field (check Prisma schema - may need migration)
5. Translate all remaining English labels to PT-BR:
   - "Phone" (line 214) → "Telefone"
   - "Optional" → "(Opcional)"
   - "SSN" → "SSN (EUA)"
   - "Passport" → "Passaporte"
   - "Passport number" → "Número do passaporte"
   - Any other English labels

**Verify:**
```bash
# Create customer with DOB field
# Check customer detail page displays DOB
# Create customer without DOB (should work - optional field)
```

**Done:** Customer form has DOB field, API accepts it, all labels in Portuguese.

### Task 3: Prisma Schema Update (if needed)

**Files:** `prisma/schema.prisma`

**Action:**
1. Check if `Customer` model has `dateOfBirth` field
2. If missing, add: `dateOfBirth DateTime?` (optional field)
3. Run `npm run db:generate && npm run db:push`

**Verify:**
```bash
npm run db:generate
npm run db:push
```

**Done:** Database schema supports DOB field, Prisma client regenerated.

## Success Criteria

- [ ] Invoice form has discount type toggle (amount/percentage)
- [ ] Discount percentage calculates correctly (% applied to subtotal)
- [ ] Customer form has DOB field (optional)
- [ ] Customer API accepts and stores DOB
- [ ] All labels in both forms are in Portuguese Brazil
- [ ] No English labels remaining (except technical terms like SSN)
- [ ] Forms function correctly with new fields

## Notes

**Translation Guidelines:**
- "Optional" → "(Opcional)"
- "Phone" → "Telefone"
- "Email" → "Email" (keep same)
- "Required" → "Obrigatório"
- Keep technical abbreviations: SSN, CPF, QB (QuickBooks)

**Discount Type Logic:**
```typescript
// If discountType === "percentage":
const discountAmount = subtotal * (parseFloat(form.discount) / 100);
const total = subtotal - discountAmount;

// If discountType === "amount":
const total = subtotal - parseFloat(form.discount);
```
