---
type: quick-summary
number: "025"
description: Add contract generator page for commercial with DocuSign template selection
status: complete
duration: 15 min
commit: fa0f362
---

# Quick Task 025 Summary: DocuSign Template Selection for Contracts

## Completed

### Task 1: DocuSign Service - Template Listing
**Files Modified:** `lib/services/docusign.service.ts`

Added two new methods:

1. **`listTemplates()`** - Fetches all available templates from DocuSign account
   - Returns template ID, name, description, created/modified dates
   - Uses DocuSign REST API v2.1 `/templates` endpoint
   - Orders templates by name for consistent display

2. **`createEnvelopeFromSelectedTemplate()`** - Creates envelope from specific template
   - Accepts templateId, signerEmail, signerName, and optional custom fields
   - Uses Composite Templates pattern for maximum flexibility
   - Populates template tabs with customer/invoice data

### Task 2: Templates API Endpoint
**Files Created:** `app/api/docusign/templates/route.ts`

- GET `/api/docusign/templates` - Returns available DocuSign templates
- Requires authentication
- Returns array of templates with ID, name, description

### Task 3: Contract Creation Page Updated
**Files Modified:** `app/dashboard/contracts/new/page.tsx`

- Added template dropdown selector (required field)
- Templates fetched on page load from `/api/docusign/templates`
- Shows template description when selected
- Disabled submit until template is selected
- Sends templateId in contract creation request

### Task 4: Contracts API Updated
**Files Modified:** `app/api/contracts/route.ts`

- Accepts `templateId` parameter in POST body
- Uses `createEnvelopeFromSelectedTemplate()` when templateId provided
- Populates custom fields from customer/invoice data
- Falls back to legacy `createEnvelopeFromTemplate()` if no templateId

## Test Results

Successfully tested template listing:
```
Templates found: 3
- Complete com o Docusign: Carreira USA - Contrato Programa Pass  - Jéssica Marques.docx (1aa8d5a9-bf75-46a7-931d-2f6acfdb3eac)
- (77e78469-bbc7-486b-ac74-7259e3cc2a81)
- (fbc69c03-debf-4eb1-b088-fdb0fb43d9a1)
```

Note: 2 templates have empty names in DocuSign - this is a DocuSign configuration issue, not a code issue.

## Deliverables

| File | Change |
|------|--------|
| `lib/services/docusign.service.ts` | +120 lines (listTemplates, createEnvelopeFromSelectedTemplate) |
| `app/api/docusign/templates/route.ts` | New file - templates API endpoint |
| `app/api/contracts/route.ts` | +30 lines (templateId support) |
| `app/dashboard/contracts/new/page.tsx` | +50 lines (template dropdown UI) |

## Usage

1. Commercial user navigates to `/dashboard/contracts/new`
2. Selects customer from dropdown
3. **Selects DocuSign template from dropdown** (new required field)
4. Optionally links to an invoice
5. Fills signer information
6. Clicks "Create & Send Contract"
7. Contract is created using the selected template

## Notes

- Template selection is now required (previously used DOCUSIGN_TEMPLATE_ID env var)
- Custom fields populated: customer_name, customer_email, invoice_number, invoice_amount, invoice_due_date
- If template tabs don't match these field names, data won't be populated (DocuSign silently ignores mismatched tabs)
