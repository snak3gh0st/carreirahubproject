import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole, shouldScopeOperationalWork } from "@/lib/roles";
import {
  SLA_DAYS_PER_PHASE,
  SLA_WARNING_DAYS,
  NO_SESSION_THRESHOLD_DAYS,
  type FlagType,
} from "@/lib/constants/sla";

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (!isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: {
      status: "ACTIVE",
      ...(shouldScopeOperationalWork(role) ? { assignedToId: userId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, qbBalance: true } },
      currentPhase: { select: { id: true, label: true, key: true, slaDays: true } },
      assignedTo: { select: { id: true, name: true } },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      sessions: {
        orderBy: { sessionDate: "desc" },
        take: 1,
        select: { sessionDate: true },
      },
    },
  });

  interface FlaggedRow {
    enrollmentId: string;
    studentName: string;
    customerId: string;
    phaseLabel: string;
    assigneeName: string;
    flags: { type: FlagType; daysRemaining?: number; daysSinceSession?: number }[];
    _sort: { slaExpiring: boolean; daysRemaining: number };
  }

  const now = new Date();

  const flagged: FlaggedRow[] = enrollments
    .map((enrollment) => {
      const latestTransitionDate =
        enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
      const phaseAgeDays = daysBetween(latestTransitionDate, now);
      const phaseSlaDays = enrollment.currentPhase?.slaDays ?? SLA_DAYS_PER_PHASE;
      const daysRemaining = phaseSlaDays - phaseAgeDays;
      const slaExpiring = daysRemaining <= SLA_WARNING_DAYS;

      const lastSessionDate = enrollment.sessions[0]?.sessionDate;
      const daysSinceSession = lastSessionDate
        ? daysBetween(lastSessionDate, now)
        : Infinity;
      const noRecentSession = daysSinceSession >= NO_SESSION_THRESHOLD_DAYS;

      if (!slaExpiring && !noRecentSession) return null;

      const flags: { type: FlagType; daysRemaining?: number; daysSinceSession?: number }[] = [];
      if (slaExpiring) {
        flags.push({ type: "sla_expiring", daysRemaining });
      }
      if (noRecentSession) {
        flags.push({
          type: "no_recent_session",
          daysSinceSession: daysSinceSession === Infinity ? undefined : daysSinceSession,
        });
      }

      return {
        enrollmentId: enrollment.id,
        studentName: enrollment.customer.name,
        customerId: enrollment.customer.id,
        phaseLabel: enrollment.currentPhase?.label ?? "—",
        assigneeName: enrollment.assignedTo?.name ?? "—",
        flags,
        _sort: { slaExpiring, daysRemaining },
      };
    })
    .filter((r): r is FlaggedRow => r !== null);

  // Sort: SLA-flagged first, then by daysRemaining ascending
  flagged.sort((a: FlaggedRow, b: FlaggedRow) => {
    const aHasSla = a._sort.slaExpiring ? 1 : 0;
    const bHasSla = b._sort.slaExpiring ? 1 : 0;
    if (aHasSla !== bHasSla) return bHasSla - aHasSla;
    return a._sort.daysRemaining - b._sort.daysRemaining;
  });

  const students = flagged.map(({ _sort: _ignored, ...rest }: FlaggedRow) => rest);

  return NextResponse.json({ students, count: students.length });
}
