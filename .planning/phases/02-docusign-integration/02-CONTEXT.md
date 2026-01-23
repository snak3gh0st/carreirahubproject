# Phase 2: DocuSign Integration - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Automate contract generation and signature workflow, integrating DocuSign with QuickBooks to track contract status and trigger downstream actions. This phase delivers webhook security, template-based envelope creation, S3 document storage, and a Finance dashboard for contract management.

</domain>

<decisions>
## Implementation Decisions

### Contract Trigger Points
- Contracts sent **simultaneously** with invoice creation (not after payment)
- All invoice types trigger contract generation (COMMERCIAL, FINANCIAL, OPERATIONAL)
- Single contract for installment invoices (not one per installment)
- Invoice creation proceeds even if DocuSign unavailable; contract queued/retried separately
- No additional validation checks prevent sending (no email check, no deal requirement)
- Error handling: Auto-retry 3 times with exponential backoff, then alert Finance team
- Manual trigger: Commercial users can trigger/retry from **dedicated contract dashboard**
- Contract ownership: User who created the invoice becomes contract owner
- Ownership fallback: If invoice auto-created (webhook), track deal owner if available; otherwise unassigned

### Role-Based Access
- **Commercial users**: See only their own contracts on dashboard
- **Finance users**: See all contracts
- **Admin users**: See all contracts
- Multiple Commercial users supported (each manages their portfolio)

### Template Management
- **Template selection**: User selects template from dropdown when sending contract
- **Template source**: Fetch available templates from DocuSign API dynamically
- **Merge fields**: Include all data categories:
  - Customer data (name, email, phone, address, QB ID)
  - Invoice data (number, date, amount, due date, line items, payment terms)
  - Deal data (value, stage, product/service details, custom fields)
  - Company data (Carreira USA info, address, contact)
- **Installment representation**: Contract shows installment breakdown (table/list of dates and amounts)
- **Missing data handling**: Use placeholder text (e.g., "[Not provided]", "N/A") if fields missing
- **Preview**: Optional preview feature available; users can preview before sending or send immediately

### Signature Workflow
- **Signers**: Customer + Carreira representative (dual signature required)
- **Signing order**: Carreira representative signs first, then customer
- **Carreira signer**: Single company signer for all contracts (e.g., CEO, legal rep)
- **Reminder emails**: DocuSign auto-reminders enabled (default schedule, every 3 days)

### Document Storage & Access
- **Presigned URL expiration**: 7 days
- **Download access**: Finance team, Admin users, and Customer (via DocuSign email link)
- **Contract owner (Commercial)**: Does NOT have download access in this phase
- **Retention policy**: Never delete contracts; retain indefinitely in S3
- **Archive strategy**: No archival to Glacier or deletion needed

### Claude's Discretion
- URL expiration handling (auto-regenerate vs error message vs always-fresh)
- Exact retry backoff algorithm
- Contract dashboard UI/UX layout
- Error message wording and actionable next steps
- S3 bucket configuration and key naming scheme

</decisions>

<specifics>
## Specific Ideas

- Contract ownership follows invoice creator (supports multi-Commercial user scenario)
- Deal owner fallback ensures system-created invoices can still track ownership
- Template dropdown fetches live from DocuSign API (no hardcoded list maintenance)
- Installment contracts show full payment schedule breakdown (Finance needs visibility)
- Dual signature with Carreira pre-signing reduces customer friction (contract already approved)
- 7-day presigned URLs balance security and convenience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-docusign-integration*
*Context gathered: 2026-01-22*
