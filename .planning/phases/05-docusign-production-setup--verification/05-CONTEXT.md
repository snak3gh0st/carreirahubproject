# Phase 5: DocuSign Production Setup & Verification - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure and verify DocuSign JWT authentication in production environment with proper RSA keypairs, credentials, and consent grants. Verify end-to-end contract workflow in production, including automated contract triggering when invoices are sent.

</domain>

<decisions>
## Implementation Decisions

### Credential Management
- Tech lead/admin only access to DocuSign production credentials
- Claude's discretion on: storage location (likely Vercel env vars), rotation strategy, backup approach

### Testing Approach
- Test envelopes sent to internal team emails only (safest)
- Use real invoice data for testing (not synthetic)
- Full end-to-end verification required: JWT auth → envelope creation → email sent → signing → webhook → S3 storage → download
- Claude's discretion on: whether to void test envelopes after verification or keep for reference

### Error Handling
- Tech team only notifications when DocuSign fails
- Email notification delivery for alerts
- Manual contract process as fallback when DocuSign completely unavailable
- Claude's discretion on: JWT auth failure handling (retry logic, exponential backoff, etc.)

### Contract Triggering Workflow
**CRITICAL WORKFLOW DECISIONS:**

- **Trigger timing**: When commercial sends an invoice (no Finance approval required)
- **Delay**: 5-10 minutes after invoice is sent
- **First invoice only**: Contracts only sent for the first invoice (master contract with all installments), not for individual installment invoices
- **Invoice series**: Different programs have different invoice series/numbering
- **Duplicate prevention**: Skip contract + alert commercial if customer already has contract for same invoice series
- **New programs**: Different invoice series = new contract (customer hiring Carreira again for different program)
- **No manual overrides**: Fully automated - no commercial checkbox to skip/force contracts
- **Contract data**: Populate with customer details + full payment plan (all installment amounts and due dates)
- **Failure handling**: Keep invoice if contract generation fails, retry contract later (don't rollback invoice)
- **Status visibility**: Show contract status in real-time on invoice detail page
- **Email delivery**: Two separate emails (invoice from QB, contract from DocuSign 5-10 min later)
- **Payment order**: Allow contract signing before payment, but alert commercial if this happens (unusual order)
- **Expiration**: Contracts expire after X days (Claude's discretion on exact number)
- **Declined contracts**: Alert commercial + manual follow-up (don't auto-regenerate)
- **Reminders**: Automated reminders every 3 days until signed or expired
- **View notifications**: Notify commercial when customer opens/views contract (not just signature)
- **Multiple templates**: Support multiple DocuSign templates for different program types
- **Template selection**: Map invoice program/service type to specific DocuSign template
- **Missing template**: Fail with clear error (block contract generation, alert tech team)
- **Commercial notifications**: Notify commercial when contract is sent to client
- **Invoice dependency**: Block contract send if invoice creation/send fails

Claude's discretion on:
- How to detect "first invoice" (likely: first invoice per customer per invoice series)
- Contract expiration period (likely 30-60 days)
- Exact template selection mapping implementation

### Documentation Requirements
- Minimal documentation: environment variables and credential locations only
- Audience: Non-technical team (Finance, Commercial)
- Text only (no screenshots)
- Claude's discretion on: documentation location (README vs separate docs folder vs .env.example)

</decisions>

<specifics>
## Specific Ideas

**Invoice → Contract Flow:**
```
1. Commercial creates invoice in system
2. Invoice sent to QuickBooks
3. If QB send successful:
   - Wait 5-10 minutes
   - Check: Is this first invoice for this customer in this invoice series?
   - Check: Does customer already have contract for this series?
   - If yes to first, no to second: Generate contract
4. Look up DocuSign template ID based on program/service type
5. Send contract to DocuSign with customer + full payment plan data
6. Notify commercial that contract was sent
7. Show contract status on invoice detail page
8. DocuSign sends automated reminders every 3 days
9. Notify commercial when customer views contract
10. Notify commercial when customer signs contract
11. Webhook processes signature → store in S3 → update status
```

**Key Business Rules:**
- One contract per customer per program (identified by invoice series)
- Contract contains full installment plan, not just one payment
- Commercial team gets visibility into contract lifecycle
- System alerts on unusual patterns (sign before pay, declined contracts, duplicate attempts)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (production setup and verification of existing Phase 2 code).

</deferred>

---

*Phase: 05-docusign-production-setup--verification*
*Context gathered: 2026-01-27*
