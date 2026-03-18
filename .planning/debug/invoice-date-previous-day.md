---
status: awaiting_human_verify
trigger: "Investigate issue: invoice-date-previous-day"
created: 2026-03-02T00:00:00Z
updated: 2026-03-02T14:03:36Z
---

## Current Focus

hypothesis: Persisted previous-day symptom was caused by remaining UTC/local implicit date boundaries in create-form "today" logic and create-time realtime QuickBooks overdue calculation.
test: completed targeted code fixes and ran focused validation (`eslint` on changed files + `tsc --noEmit`) with deterministic timezone behavior checks.
expecting: immediate post-create invoice view no longer drifts dates or flips overdue state based on time-of-day/UTC boundary.
next_action: user verifies in real create-invoice workflow that displayed date/day status now matches selected business day.

## Symptoms

expected: When creating an invoice, creation and due dates should display the exact selected calendar day (local PT-BR/business timezone), without shifting to previous day.
actual: Dates are shown as the previous day in UI after invoice creation, causing wrong overdue calculations/status (e.g., "Vencida há 1 dias").
errors: No explicit runtime error reported.
reproduction: Create a new invoice with due date set to a specific day, open invoice detail page immediately, compare displayed due/created dates and overdue badge.
started: Ongoing now; similar timezone bug was reportedly fixed previously but issue persists.

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: realtime `syncSingleInvoice` in create flow overwrites newly created local dueDate
  evidence: in `lib/services/quickbooks-sync.service.ts`, existing invoice update path explicitly preserves dueDate and only updates status/paid fields; no dueDate write in existing update data
  timestamp: 2026-03-02T13:48:19Z

- hypothesis: Prisma DB write/read mutates UTC-noon dueDate to midnight during persistence roundtrip
  evidence: controlled script created temporary invoice with dueDate `2026-03-15T12:00:00.000Z` and read back exact same value before deletion
  timestamp: 2026-03-02T13:56:48Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-02T13:45:48Z
  checked: invoice UI and date usage grep results
  found: invoice detail renders overdue using `new Date(invoice.dueDate)` and day-diff math in `app/dashboard/invoices/[id]/page.tsx`; invoice creation form writes due date using `toISOString().split('T')[0]` in `app/dashboard/invoices/new/InvoiceForm.tsx`
  implication: there are at least two timezone-sensitive boundaries (form serialization and UI parsing) likely causing day shifts

- timestamp: 2026-03-02T13:46:15Z
  checked: full form/api/detail code paths
  found: create API already parses dueDate via `parseLocalDate()` and stores `Date` with UTC-noon intent; invoice detail page repeatedly formats and compares via raw `new Date(invoice.dueDate)` and computes overdue days from raw timestamp deltas
  implication: root issue is likely UI/date-comparison layer, not invoice creation persistence layer

- timestamp: 2026-03-02T13:46:42Z
  checked: shared date helper + invoice detail/payment UI components
  found: `lib/utils/date.ts` defines UTC-noon date-only strategy, but invoice detail and payment status components still use raw `new Date(invoice.dueDate)` for display and day-diff calculations
  implication: UI is vulnerable to any midnight-based dueDate values introduced by sync/edit paths

- timestamp: 2026-03-02T13:48:19Z
  checked: QuickBooks sync/import dueDate mapping
  found: `lib/services/quickbooks-sync.service.ts` uses `new Date(qbInvoice.DueDate)` in multiple paths (`syncSingleInvoice` status check and bulk sync/import create/update mappings)
  implication: QB date-only strings are parsed as midnight-based timestamps, which can appear as previous day in local timezone and cascade into incorrect overdue labeling

- timestamp: 2026-03-02T13:50:35Z
  checked: project lint after code changes
  found: `npm run lint` completed with only pre-existing warnings (react-hooks/exhaustive-deps) and no new errors from modified files
  implication: fixes compile/lint cleanly within current project baseline

- timestamp: 2026-03-02T13:52:20Z
  checked: human verification checkpoint response
  found: user reports issue still persists immediately after creating invoice (still previous-day display)
  implication: prior fix was incomplete; must isolate exact create-invoice boundary where day shift is introduced

- timestamp: 2026-03-02T13:54:31Z
  checked: create-invoice code path (form submit, create API, invoice detail page, payment status card)
  found: form submits `dueDate` as raw `YYYY-MM-DD`; create API parses with `parseLocalDate`; DB write uses parsed `invoiceDueDate`; response is only used for first invoice id redirect; detail/payment due-date rendering now uses `normalizeDateOnly`
  implication: remaining shift is unlikely from dueDate form serialization or dueDate detail rendering; likely in another date field/path (especially createdAt render) or data persisted as non-normalized timestamp in some create-time branch

- timestamp: 2026-03-02T13:56:48Z
  checked: controlled Prisma roundtrip + invoice detail/workflow date render points
  found: DB preserves UTC-noon dueDate in roundtrip; invoice detail/workflow still render `createdAt` and workflow timestamps via raw `toLocaleDateString` without explicit business timezone (workflow runs client-side)
  implication: exact day-shift boundary for persisted create-time timestamps is UI parse/render timezone handling, not payload serialization or DB write

- timestamp: 2026-03-02T13:57:34Z
  checked: minimal UI fix on create-path detail rendering
  found: added explicit `America/Sao_Paulo` timezone to invoice-detail created/updated/paid sync timestamps and workflow timeline date rendering
  implication: removes implicit runtime timezone parsing boundary that could shift visible day immediately after creation

- timestamp: 2026-03-02T13:58:04Z
  checked: focused verification commands
  found: `npx eslint "app/dashboard/invoices/[id]/page.tsx" "components/invoices/workflow-timeline.tsx"` passes with no issues; timezone-render demo confirms same ISO timestamp renders previous day under implicit local timezone but stable when explicit timezone is used
  implication: implemented fix is syntactically valid and directly addresses the identified render-time boundary

- timestamp: 2026-03-02T13:59:51Z
  checked: human verification checkpoint response after prior fix
  found: user still reports issue persists immediately after creating invoice ("Ainda está mostrando data anterior ao criar a invoice.")
  implication: at least one date field/path in immediate post-create flow remains unnormalized and must be isolated precisely

- timestamp: 2026-03-02T14:02:03Z
  checked: full create-form/detail rendering plus create-time realtime sync path and timezone simulation
  found: create form still uses `new Date().toISOString().split('T')[0]` for date input minimum and "today" comparisons (UTC day boundary), and `quickbooks-sync.service.ts` still computes overdue with `dueDate < today` timestamp comparison after parsing dueDate as UTC-noon
  implication: these boundaries can produce day drift and same-day overdue mislabeling immediately after create, matching persisted user symptom

- timestamp: 2026-03-02T14:03:36Z
  checked: applied fix + focused verification
  found: `InvoiceForm` now derives today from explicit `America/Sao_Paulo` date key for date-min and immediate-send comparison; `quickbooks-sync.service.ts` now computes overdue using date-key comparison in business timezone and normalizes all QB dueDate imports via `parseQuickBooksDueDate`; `npx eslint` and `npx tsc --noEmit` pass (only pre-existing hook warning)
  implication: removed remaining implicit timezone/midnight boundaries on immediate create path and its first realtime sync

## Resolution

root_cause: Remaining issue came from two specific fields/paths: (1) create form "today" derivation used `new Date().toISOString().split('T')[0]` (UTC day boundary) for due-date min and immediate-send condition copy; (2) create-time realtime QB sync used `dueDate < today` timestamp comparison, which can mark same-day invoices as overdue based on clock time instead of calendar day.
fix: Replaced create-form UTC-day logic with explicit business-timezone (`America/Sao_Paulo`) date key; replaced QB sync overdue check with business-timezone calendar-day key comparison and ensured QB dueDate imports are normalized via `parseQuickBooksDueDate` across sync paths.
verification: `npx eslint "app/dashboard/invoices/new/InvoiceForm.tsx" "lib/services/quickbooks-sync.service.ts"` passes (only pre-existing warning). `npx tsc --noEmit` passes. Deterministic timezone simulation confirms prior UTC split/timestamp comparison drift and new calendar-day key approach removes it.
files_changed: ["app/dashboard/invoices/new/InvoiceForm.tsx", "lib/services/quickbooks-sync.service.ts"]
