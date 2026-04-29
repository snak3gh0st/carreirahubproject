# Email Notifications — Gap Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 cron-triggered notifications covering contract renewal warnings, an ops daily digest (enrollment end-dates + inactive students), customer form reminders, and stale invoice payment reminders.

**Architecture:** Each notification is a standalone `/api/cron/*` Next.js route following the existing `contract-expiration` / `seller-digest` patterns. New email methods are added to `EmailService`. A schema migration adds reminder-tracking fields to `FormAssignment` and three new `NotificationType` enum values.

**Tech Stack:** Next.js App Router, Prisma ORM, Resend SDK (via `EmailService`), date-fns, Vercel cron

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `lastReminderAt`, `reminderCount` to `FormAssignment`; add 3 `NotificationType` values |
| `lib/services/email.service.ts` | Modify | Add `ContractRenewalData`, `OpsDigestData` interfaces + `sendContractRenewalWarning`, `sendOpsDailyDigest`, `sendHubFormReminder`, `sendStaleInvoiceReminder` methods |
| `app/api/cron/contract-renewal-reminder/route.ts` | Create | P1 cron — pre-expiry warning to seller |
| `app/api/cron/ops-daily-digest/route.ts` | Create | P3+P4 cron — enrollment ending + inactive students to coordinator |
| `app/api/cron/form-completion-reminder/route.ts` | Create | P5 cron — form pending reminder to customer |
| `app/api/cron/invoice-payment-reminder/route.ts` | Create | P6 cron — stale invoice reminder to customer |
| `vercel.json` | Modify | Add 4 cron schedules |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `FormAssignment` model**

In `prisma/schema.prisma`, find the `FormAssignment` model and add two fields after `assignedAt`:

```prisma
model FormAssignment {
  id           String               @id @default(cuid())
  templateId   String
  status       FormAssignmentStatus @default(PENDING)
  assignedAt   DateTime             @default(now())
  lastReminderAt DateTime?
  reminderCount  Int                @default(0)
  updatedAt    DateTime             @updatedAt

  customerId   String
  customer     Customer             @relation(fields: [customerId], references: [id])
  assignedById String
  assignedBy   User                 @relation("AssignedForms", fields: [assignedById], references: [id])
  submission   FormSubmission?

  @@index([customerId])
  @@map("form_assignments")
}
```

- [ ] **Step 2: Add 3 new values to `NotificationType` enum**

Find the `NotificationType` enum in `prisma/schema.prisma` and append:

```prisma
enum NotificationType {
  CONTRACT_SENT
  CONTRACT_REMINDER
  CONTRACT_SIGNED
  CONTRACT_EXPIRED
  PAYMENT_LINK_SENT
  PAYMENT_REMINDER
  PAYMENT_RECEIVED
  HUB_WELCOME
  HUB_INVOICE_AVAILABLE
  HUB_PASSWORD_RESET
  INVOICE_OVERDUE_SELLER
  INVOICE_PAID_SELLER
  CONTRACT_SIGNED_SELLER
  CONTRACT_UNSIGNED_SELLER
  SELLER_DAILY_DIGEST
  FINANCE_DAILY_DIGEST
  ADMIN_WEEKLY_DIGEST
  CONTRACT_RENEWAL_WARNING
  OPS_DAILY_DIGEST
  HUB_FORM_REMINDER
}
```

- [ ] **Step 3: Run migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `add_form_assignment_reminder_fields_and_notification_types`

Expected: migration created and applied with no errors.

- [ ] **Step 4: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors. The new enum values `CONTRACT_RENEWAL_WARNING`, `OPS_DAILY_DIGEST`, `HUB_FORM_REMINDER` should now be importable from `@prisma/client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add FormAssignment reminder fields and new NotificationType values"
```

---

## Task 2: EmailService — P1 Contract Renewal Warning

**Files:**
- Modify: `lib/services/email.service.ts`

- [ ] **Step 1: Add `ContractRenewalData` interface**

In `lib/services/email.service.ts`, after the existing `AdminDigestData` interface (~line 191), add:

```typescript
export interface ContractRenewalData {
  id: string;
  signerName: string;
  signerEmail: string;
  sentAt: Date | null;
  expiresAt: Date;
  reminderCount: number;
}
```

- [ ] **Step 2: Add `sendContractRenewalWarning` public method**

After the `sendSellerContractUnsigned` method, add:

```typescript
async sendContractRenewalWarning(
  contract: ContractRenewalData,
  seller: { name: string | null; email: string },
  daysUntilExpiry: number
): Promise<void> {
  const urgency: 'warn' | 'error' = daysUntilExpiry <= 7 ? 'error' : 'warn';
  const subject = `Contrato expira em ${daysUntilExpiry} dia(s) — ${esc(contract.signerName)}`;

  const bodyHtml = `
    <p>Olá ${esc(seller.name || 'vendedor')},</p>
    <p>O contrato abaixo expira em <strong>${daysUntilExpiry} dia(s)</strong>. Reenvie ou entre em contato com o cliente para evitar que expire sem assinatura.</p>
    ${calloutBox(
      `<h4 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde};">Expira em ${daysUntilExpiry} dia(s)</h4>
       <p style="margin:4px 0;"><strong>Assinante:</strong> ${esc(contract.signerName)}</p>
       <p style="margin:4px 0;"><strong>E-mail:</strong> ${esc(contract.signerEmail)}</p>
       <p style="margin:4px 0;"><strong>Enviado em:</strong> ${fmtDateBR(contract.sentAt)}</p>
       <p style="margin:4px 0;"><strong>Expira em:</strong> ${fmtDateBR(contract.expiresAt)}</p>
       <p style="margin:4px 0;"><strong>Lembretes enviados:</strong> ${contract.reminderCount}</p>`,
      urgency
    )}
    <p>Reenvie o contrato pelo painel ou ligue para o cliente.</p>
  `;

  await this.sendEmailWithTracking(
    seller.email,
    subject,
    renderBaseLayout({
      title: `Contrato expira em ${daysUntilExpiry} dia(s)`,
      preheader: `Ação necessária — ${contract.signerName} ainda não assinou`,
      bodyHtml,
      ctaLabel: 'Ver contrato',
      ctaUrl: `${APP_URL}/dashboard/contracts/${contract.id}`,
    }),
    NotificationType.CONTRACT_RENEWAL_WARNING,
    { contractId: contract.id }
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/services/email.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "feat(email): add sendContractRenewalWarning method"
```

---

## Task 3: Cron — P1 Contract Renewal Reminder

**Files:**
- Create: `app/api/cron/contract-renewal-reminder/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, ContractRenewalData } from '@/lib/services/email.service';
import { addDays, subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/contract-renewal-reminder
 *
 * Sends pre-expiration warnings to the deal/invoice owner for unsigned contracts
 * expiring within 30 days. Fires at three milestones: 30d, 14d, 7d before expiry.
 *
 * Deduplication: uses Contract.reminderCount + Contract.lastReminderAt.
 * Max 3 reminders per contract.
 *
 * Schedule (vercel.json): 0 7 * * *
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ContractRenewalReminder] Starting...');

    const now = new Date();
    const thirtyDaysOut = addDays(now, 30);

    const contracts = await prisma.contract.findMany({
      where: {
        status: 'SENT_FOR_SIGNATURE',
        expiresAt: { gte: now, lte: thirtyDaysOut },
        OR: [
          { reminderCount: 0 },
          {
            reminderCount: 1,
            lastReminderAt: { lte: subDays(now, 14) },
            expiresAt: { lte: addDays(now, 14) },
          },
          {
            reminderCount: 2,
            lastReminderAt: { lte: subDays(now, 5) },
            expiresAt: { lte: addDays(now, 7) },
          },
        ],
      },
      include: {
        deal: { include: { owner: true } },
        invoices: { select: { id: true } },
      },
    });

    console.log(`[ContractRenewalReminder] Found ${contracts.length} contract(s) to notify`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const contract of contracts) {
      try {
        if (!contract.expiresAt) { skipped++; continue; }

        // Resolve seller: deal.owner → invoice.owner fallback
        let seller: { id: string; name: string | null; email: string; role: string } | null = null;

        if (contract.deal?.owner && contract.deal.owner.email) {
          seller = contract.deal.owner;
        }

        if (!seller && contract.invoices.length > 0) {
          const inv = await prisma.invoice.findUnique({
            where: { id: contract.invoices[0].id },
            include: { owner: true },
          });
          if (inv?.owner?.email) seller = inv.owner;
        }

        if (!seller) {
          console.log(`[ContractRenewalReminder] No seller for contract ${contract.id}, skipping`);
          skipped++;
          continue;
        }

        const daysUntilExpiry = differenceInDays(contract.expiresAt, now);

        const contractData: ContractRenewalData = {
          id: contract.id,
          signerName: contract.signerName,
          signerEmail: contract.signerEmail,
          sentAt: contract.sentAt,
          expiresAt: contract.expiresAt,
          reminderCount: contract.reminderCount,
        };

        await emailService.sendContractRenewalWarning(contractData, seller, daysUntilExpiry);

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now,
          },
        });

        sent++;
        console.log(`[ContractRenewalReminder] Sent to ${seller.email} for contract ${contract.id} (${daysUntilExpiry}d)`);
      } catch (err) {
        failed++;
        console.error(`[ContractRenewalReminder] Failed for contract ${contract.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: contracts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ContractRenewalReminder] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/contract-renewal-reminder/route.ts
git commit -m "feat(cron): add contract-renewal-reminder — P1 pre-expiry warning to seller"
```

---

## Task 4: EmailService — P3+P4 Ops Daily Digest

**Files:**
- Modify: `lib/services/email.service.ts`

- [ ] **Step 1: Add `OpsDigestData` interface**

After the `ContractRenewalData` interface added in Task 2, add:

```typescript
export interface OpsDigestData {
  date: string;
  endingSoon: Array<{
    studentName: string;
    programType: string;
    endDate: Date;
    daysRemaining: number;
  }>;
  inactive: Array<{
    studentName: string;
    lastSessionDate: Date | null;
    daysSinceLastSession: number;
  }>;
}
```

- [ ] **Step 2: Add `sendOpsDailyDigest` public method**

After `sendContractRenewalWarning`, add:

```typescript
async sendOpsDailyDigest(
  coordinator: { name: string | null; email: string },
  data: OpsDigestData
): Promise<void> {
  const endingSoonRows = data.endingSoon.map((s) =>
    tableRow([
      esc(s.studentName),
      esc(s.programType),
      fmtDateBR(s.endDate),
      `${s.daysRemaining}d`,
    ])
  );

  const inactiveRows = data.inactive.map((s) =>
    tableRow([
      esc(s.studentName),
      s.lastSessionDate ? fmtDateBR(s.lastSessionDate) : 'Nenhuma sessão',
      `${s.daysSinceLastSession}d`,
    ])
  );

  const endingSoonSection =
    data.endingSoon.length > 0
      ? `${sectionTitle('Matrículas encerrando em breve')}${dataTable(
          ['Aluno', 'Programa', 'Encerramento', 'Dias restantes'],
          endingSoonRows
        )}`
      : '';

  const inactiveSection =
    data.inactive.length > 0
      ? `${sectionTitle('Alunos sem sessão há 14+ dias')}${dataTable(
          ['Aluno', 'Última sessão', 'Dias sem sessão'],
          inactiveRows
        )}`
      : '';

  const bodyHtml = `
    <p>Olá ${esc(coordinator.name || 'coordenador')},</p>
    <p>Seu resumo de alunos que precisam de atenção hoje.</p>
    ${endingSoonSection}
    ${inactiveSection}
  `;

  const totalCount = data.endingSoon.length + data.inactive.length;

  await this.sendEmailSimple({
    to: coordinator.email,
    subject: `Ops — ${totalCount} aluno(s) precisam de atenção — ${data.date}`,
    html: renderBaseLayout({
      title: `Ops — ${totalCount} aluno(s) hoje`,
      preheader: `${data.endingSoon.length} encerrando em breve · ${data.inactive.length} sem sessão`,
      bodyHtml,
      ctaLabel: 'Ver alunos',
      ctaUrl: `${APP_URL}/ops`,
    }),
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "feat(email): add sendOpsDailyDigest method for ops coordinator"
```

---

## Task 5: Cron — P3+P4 Ops Daily Digest

**Files:**
- Create: `app/api/cron/ops-daily-digest/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, OpsDigestData } from '@/lib/services/email.service';
import { addDays, subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/ops-daily-digest
 *
 * Daily digest for each OPERATIONAL coordinator with two sections:
 *   A) Enrollments ending within 30 days (P3)
 *   B) Active students with no session in the last 14 days (P4)
 *
 * One email per coordinator covering only their students.
 * Skipped entirely if both sections are empty for that coordinator.
 *
 * Schedule (vercel.json): 15 8 * * *  (8:15 AM UTC — avoids 8:00 AM cluster)
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[OpsDailyDigest] Starting...');

    const now = new Date();
    const dateLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const thirtyDaysOut = addDays(now, 30);

    // P3: enrollments ending within 30 days
    const endingSoonEnrollments = await prisma.mentorshipEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now, lte: thirtyDaysOut },
      },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { id: true, name: true, email: true, active: true } },
      },
    });

    // P4: active enrollments — include last session to detect inactivity
    const allActiveEnrollments = await prisma.mentorshipEnrollment.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { id: true, name: true, email: true, active: true } },
        sessions: {
          orderBy: { sessionDate: 'desc' },
          take: 1,
        },
      },
    });

    const inactiveEnrollments = allActiveEnrollments.filter((e) => {
      if (e.sessions.length === 0) return true;
      return differenceInDays(now, e.sessions[0].sessionDate) >= 14;
    });

    // Group by coordinator
    type CoordData = {
      coordinator: { id: string; name: string | null; email: string };
      endingSoon: typeof endingSoonEnrollments;
      inactive: typeof inactiveEnrollments;
    };
    const coordMap = new Map<string, CoordData>();

    for (const e of endingSoonEnrollments) {
      if (!e.assignedTo.active) continue;
      const key = e.assignedToId;
      if (!coordMap.has(key)) {
        coordMap.set(key, { coordinator: e.assignedTo, endingSoon: [], inactive: [] });
      }
      coordMap.get(key)!.endingSoon.push(e);
    }

    for (const e of inactiveEnrollments) {
      if (!e.assignedTo.active) continue;
      const key = e.assignedToId;
      if (!coordMap.has(key)) {
        coordMap.set(key, { coordinator: e.assignedTo, endingSoon: [], inactive: [] });
      }
      coordMap.get(key)!.inactive.push(e);
    }

    console.log(`[OpsDailyDigest] ${coordMap.size} coordinator(s) to notify`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const [, { coordinator, endingSoon, inactive }] of coordMap) {
      try {
        if (endingSoon.length === 0 && inactive.length === 0) {
          skipped++;
          continue;
        }

        const data: OpsDigestData = {
          date: dateLabel,
          endingSoon: endingSoon.map((e) => ({
            studentName: e.customer.name,
            programType: e.programType,
            endDate: e.endDate!,
            daysRemaining: differenceInDays(e.endDate!, now),
          })),
          inactive: inactive.map((e) => {
            const lastSession = e.sessions[0]?.sessionDate ?? null;
            return {
              studentName: e.customer.name,
              lastSessionDate: lastSession,
              daysSinceLastSession: lastSession ? differenceInDays(now, lastSession) : 999,
            };
          }),
        };

        await emailService.sendOpsDailyDigest(coordinator, data);
        sent++;
        console.log(`[OpsDailyDigest] Sent to ${coordinator.email}`);
      } catch (err) {
        failed++;
        console.error(`[OpsDailyDigest] Failed for ${coordinator.email}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      totalCoordinators: coordMap.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OpsDailyDigest] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/ops-daily-digest/route.ts
git commit -m "feat(cron): add ops-daily-digest — enrollment ending soon and inactive students"
```

---

## Task 6: EmailService — P5 Form Completion Reminder

**Files:**
- Modify: `lib/services/email.service.ts`

- [ ] **Step 1: Add `sendHubFormReminder` public method**

After `sendOpsDailyDigest`, add:

```typescript
async sendHubFormReminder(
  customer: { id: string; email: string; name: string },
  templateId: string,
  assignedAt: Date,
  daysPending: number,
  language: string
): Promise<void> {
  const isPtBr = language === 'pt-BR';
  const firstName = esc(customer.name.split(' ')[0]);
  const portalUrl = `${APP_URL}/hub/login`;

  const subject = isPtBr
    ? `Lembrete: seu formulário está aguardando`
    : `Reminder: your form is waiting`;

  const bodyHtml = isPtBr
    ? `
      <p>Olá ${firstName},</p>
      <p>Você tem um formulário atribuído há <strong>${daysPending} dia(s)</strong> que ainda não foi preenchido.</p>
      ${calloutBox(
        `<p style="margin:0;"><strong>Formulário:</strong> ${esc(templateId)}</p>
         <p style="margin:4px 0 0 0;"><strong>Atribuído em:</strong> ${fmtDateBR(assignedAt)}</p>`,
        'warn'
      )}
      <p>Acesse o portal para preencher seu formulário.</p>
    `
    : `
      <p>Hi ${firstName},</p>
      <p>You have a form assigned <strong>${daysPending} day(s) ago</strong> that hasn't been completed yet.</p>
      ${calloutBox(
        `<p style="margin:0;"><strong>Form:</strong> ${esc(templateId)}</p>
         <p style="margin:4px 0 0 0;"><strong>Assigned:</strong> ${esc(new Date(assignedAt).toLocaleDateString('en-US'))}</p>`,
        'warn'
      )}
      <p>Please log in to complete your form.</p>
    `;

  await this.sendEmailWithTracking(
    customer.email,
    subject,
    renderBaseLayout({
      title: isPtBr ? 'Formulário pendente' : 'Pending form',
      preheader: isPtBr
        ? `${templateId} — pendente há ${daysPending} dia(s)`
        : `${templateId} — pending for ${daysPending} day(s)`,
      bodyHtml,
      ctaLabel: isPtBr ? 'Acessar portal' : 'Go to portal',
      ctaUrl: portalUrl,
    }),
    NotificationType.HUB_FORM_REMINDER,
    { customerId: customer.id }
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "feat(email): add sendHubFormReminder for bilingual form completion reminders"
```

---

## Task 7: Cron — P5 Form Completion Reminder

**Files:**
- Create: `app/api/cron/form-completion-reminder/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/services/email.service';
import { subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/form-completion-reminder
 *
 * Sends up to 2 reminders to Hub customers with PENDING form assignments:
 *   - Reminder 1: 3 days after assignment (reminderCount = 0)
 *   - Reminder 2: 7 days after assignment (~4 days after reminder 1)
 *
 * Tracks state via FormAssignment.reminderCount + FormAssignment.lastReminderAt.
 * Skips customers without a ClientUser (no Hub account).
 *
 * Schedule (vercel.json): 15 9 * * *  (9:15 AM UTC — avoids 9:00 AM cluster)
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[FormCompletionReminder] Starting...');

    const now = new Date();

    const assignments = await prisma.formAssignment.findMany({
      where: {
        status: 'PENDING',
        reminderCount: { lt: 2 },
        OR: [
          {
            reminderCount: 0,
            assignedAt: { lte: subDays(now, 3) },
          },
          {
            reminderCount: 1,
            lastReminderAt: { lte: subDays(now, 4) },
          },
        ],
      },
      include: {
        customer: {
          include: { clientUser: { select: { language: true } } },
        },
      },
    });

    console.log(`[FormCompletionReminder] Found ${assignments.length} assignment(s) to remind`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        const { customer } = assignment;

        if (!customer.clientUser) {
          console.log(`[FormCompletionReminder] No Hub account for customer ${customer.id}, skipping`);
          skipped++;
          continue;
        }

        const daysPending = differenceInDays(now, assignment.assignedAt);
        const language = customer.clientUser.language || 'en';

        await emailService.sendHubFormReminder(
          { id: customer.id, email: customer.email, name: customer.name },
          assignment.templateId,
          assignment.assignedAt,
          daysPending,
          language
        );

        await prisma.formAssignment.update({
          where: { id: assignment.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now,
          },
        });

        sent++;
        console.log(`[FormCompletionReminder] Sent to ${customer.email} (pending ${daysPending}d)`);
      } catch (err) {
        failed++;
        console.error(`[FormCompletionReminder] Failed for assignment ${assignment.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: assignments.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[FormCompletionReminder] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/form-completion-reminder/route.ts
git commit -m "feat(cron): add form-completion-reminder — bilingual reminder to Hub customer"
```

---

## Task 8: EmailService — P6 Stale Invoice Reminder

**Files:**
- Modify: `lib/services/email.service.ts`

Note: The existing `sendPaymentReminder` is designed for pre-due-date reminders ("due in X days"). P6 needs different copy ("pending for X days") and handles already-past-due invoices. A new method is needed rather than adapting the existing one.

- [ ] **Step 1: Add `sendStaleInvoiceReminder` public method**

After `sendHubFormReminder`, add:

```typescript
async sendStaleInvoiceReminder(
  invoice: Invoice,
  customer: Customer,
  paymentUrl: string,
  daysSinceSent: number
): Promise<void> {
  const urgent = daysSinceSent >= 60;
  const subject = `Payment reminder — Invoice ${invoice.invoiceNumber || invoice.id} — ${daysSinceSent} days pending`;

  const bodyHtml = `
    <p>Dear ${esc(customer.name)},</p>
    <p>Your invoice has been pending for <strong>${daysSinceSent} day(s)</strong>. Please process the payment at your earliest convenience.</p>
    ${calloutBox(
      `<h4 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde};">Invoice pending for ${daysSinceSent} day(s)</h4>
       <p style="margin:4px 0;"><strong>Invoice:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
       <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtMoney(Number(invoice.amount))}</p>
       <p style="margin:4px 0;"><strong>Due date:</strong> ${esc(new Date(invoice.dueDate).toLocaleDateString('en-US'))}</p>`,
      urgent ? 'error' : 'warn'
    )}
    <p>If you have already made the payment, please disregard this message.</p>
  `;

  await this.sendEmailWithTracking(
    customer.email,
    subject,
    renderBaseLayout({
      title: 'Payment reminder',
      preheader: `Invoice ${invoice.invoiceNumber || invoice.id} — ${fmtMoney(Number(invoice.amount))} — ${daysSinceSent}d pending`,
      bodyHtml,
      ctaLabel: 'Pay now',
      ctaUrl: paymentUrl,
    }),
    NotificationType.PAYMENT_REMINDER,
    { invoiceId: invoice.id, customerId: customer.id }
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/email.service.ts
git commit -m "feat(email): add sendStaleInvoiceReminder for P6 unpaid invoice nudge"
```

---

## Task 9: Cron — P6 Invoice Payment Reminder

**Files:**
- Create: `app/api/cron/invoice-payment-reminder/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/services/email.service';
import { subDays, differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) { return POST(request); }

/**
 * POST /api/cron/invoice-payment-reminder
 *
 * Sends up to 2 payment reminders to Hub customers for invoices that have been
 * unpaid for 30+ days (SENT or OVERDUE status). QB also sends its own reminders;
 * this is a supplementary touchpoint from the Hub.
 *
 *   - Reminder 1: 30 days after invoice created (paymentReminderCount = 0)
 *   - Reminder 2: 60 days after invoice created (30 days after reminder 1)
 *
 * Skips customers without a ClientUser (no Hub account).
 *
 * Schedule (vercel.json): 0 10 * * *  (10:00 AM UTC)
 * Auth: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[InvoicePaymentReminder] Starting...');

    const now = new Date();
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        paymentReminderCount: { lt: 2 },
        OR: [
          {
            paymentReminderCount: 0,
            createdAt: { lte: subDays(now, 30) },
          },
          {
            paymentReminderCount: 1,
            lastPaymentReminderAt: { lte: subDays(now, 30) },
          },
        ],
      },
      include: {
        customer: {
          include: { clientUser: { select: { language: true } } },
        },
      },
    });

    console.log(`[InvoicePaymentReminder] Found ${invoices.length} invoice(s) to remind`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of invoices) {
      try {
        const { customer } = invoice;

        if (!customer.clientUser) {
          console.log(`[InvoicePaymentReminder] No Hub account for customer ${customer.id}, skipping`);
          skipped++;
          continue;
        }

        const daysSinceSent = differenceInDays(now, invoice.createdAt);
        const paymentUrl = `${APP_URL}/hub/pay/${invoice.id}`;

        await emailService.sendStaleInvoiceReminder(
          {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            status: invoice.status,
            customer: { id: customer.id, name: customer.name, email: customer.email },
          },
          { id: customer.id, name: customer.name, email: customer.email },
          paymentUrl,
          daysSinceSent
        );

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paymentReminderCount: { increment: 1 },
            lastPaymentReminderAt: now,
          },
        });

        sent++;
        console.log(`[InvoicePaymentReminder] Sent to ${customer.email} for invoice ${invoice.id} (${daysSinceSent}d)`);
      } catch (err) {
        failed++;
        console.error(`[InvoicePaymentReminder] Failed for invoice ${invoice.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      failed,
      total: invoices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[InvoicePaymentReminder] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/invoice-payment-reminder/route.ts
git commit -m "feat(cron): add invoice-payment-reminder — stale invoice nudge to Hub customer"
```

---

## Task 10: Wire Up Cron Schedules + Smoke Test

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add 4 new cron entries to `vercel.json`**

Open `vercel.json` and append inside the `"crons"` array (after the last existing entry, before the closing `]`):

```json
    {
      "path": "/api/cron/contract-renewal-reminder",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/ops-daily-digest",
      "schedule": "15 8 * * *"
    },
    {
      "path": "/api/cron/form-completion-reminder",
      "schedule": "15 9 * * *"
    },
    {
      "path": "/api/cron/invoice-payment-reminder",
      "schedule": "0 10 * * *"
    }
```

- [ ] **Step 2: Verify full build passes**

```bash
npm run build
```

Expected: build completes with no TypeScript or lint errors.

- [ ] **Step 3: Smoke test each cron manually (dev server)**

Start the dev server: `npm run dev`

Then in a separate terminal, run each cron (replace `YOUR_CRON_SECRET` with the value from your `.env`):

```bash
# P1 — contract renewal reminder
curl -s -X GET "http://localhost:3000/api/cron/contract-renewal-reminder" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq .

# P3+P4 — ops daily digest
curl -s -X GET "http://localhost:3000/api/cron/ops-daily-digest" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq .

# P5 — form completion reminder
curl -s -X GET "http://localhost:3000/api/cron/form-completion-reminder" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq .

# P6 — invoice payment reminder
curl -s -X GET "http://localhost:3000/api/cron/invoice-payment-reminder" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq .
```

Expected for each: `{ "success": true, "sent": N, "skipped": N, "failed": 0, ... }`

If `"failed": N > 0`, check server logs for the error message from the per-item catch block.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): register 4 new notification cron schedules in vercel.json"
```
