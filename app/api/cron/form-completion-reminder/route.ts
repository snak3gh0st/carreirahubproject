import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { subDays, differenceInDays } from 'date-fns';
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";
import { createOpsManualStudentCommunicationAlert } from '@/lib/ops/internal-alerts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/form-completion-reminder
 *
 * Creates up to 2 internal reminders for Hub customers with PENDING form assignments:
 *   - Reminder 1: 3 days after assignment (reminderCount = 0)
 *   - Reminder 2: ~7 days after assignment (4 days after reminder 1)
 *
 * Tracks state via FormAssignment.reminderCount + FormAssignment.lastReminderAt.
 * Skips customers without a ClientUser (no Hub account).
 * Customer communication is manual-only: this cron does not send external email.
 *
 * Schedule (vercel.json): 15 9 * * *  (9:15 AM UTC — avoids 9:00 AM cluster)
 * Auth: Bearer ${CRON_SECRET}
 */
export const POST = withCronTelemetry("form-completion-reminder", async (request) => {
  try {

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

    let alertsCreated = 0;
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

        const nextReminderNumber = assignment.reminderCount + 1;
        const result = await createOpsManualStudentCommunicationAlert({
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          title: `Formulario pendente: ${customer.name}`,
          description: `${customer.name} tem formulario ${assignment.templateId} pendente ha ${daysPending} dia(s). Fazer contato manual antes de reenviar qualquer mensagem ao aluno.`,
          dedupeKey: `form-reminder:${assignment.id}:${nextReminderNumber}`,
          data: {
            source: "form-completion-reminder",
            formAssignmentId: assignment.id,
            templateId: assignment.templateId,
            assignedAt: assignment.assignedAt.toISOString(),
            daysPending,
            reminderNumber: nextReminderNumber,
            language,
          },
        });

        await prisma.formAssignment.update({
          where: { id: assignment.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now,
          },
        });

        if (result.created) alertsCreated++;
        console.log(`[FormCompletionReminder] Created internal alert for ${customer.email} (pending ${daysPending}d)`);
      } catch (err) {
        failed++;
        console.error(`[FormCompletionReminder] Failed for assignment ${assignment.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sent: 0,
      alertsCreated,
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
});

export const GET = POST;
