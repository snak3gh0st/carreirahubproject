import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { emailService, OpsDigestData } from '@/lib/services/email.service';
import { addDays, differenceInDays } from 'date-fns';

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
