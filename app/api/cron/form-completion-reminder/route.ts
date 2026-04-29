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
 *   - Reminder 2: ~7 days after assignment (4 days after reminder 1)
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
