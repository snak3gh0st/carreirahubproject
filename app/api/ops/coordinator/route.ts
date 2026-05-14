import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalManagerRole } from "@/lib/roles";
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
  if (!isOperationalManagerRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [phases, enrollments] = await Promise.all([
    prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        label: true,
        key: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.mentorshipEnrollment.findMany({
      where: { status: "ACTIVE" },
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
    }),
  ]);

  const now = new Date();

  interface FlaggedRow {
    enrollmentId: string;
    studentName: string;
    customerId: string;
    phaseLabel: string;
    assigneeName: string;
    flags: { type: FlagType; daysRemaining?: number; daysSinceSession?: number }[];
    _sort: { slaExpiring: boolean; daysRemaining: number };
  }

  const flagged: FlaggedRow[] = [];
  const noSessionStudents: {
    enrollmentId: string;
    studentName: string;
    phaseLabel: string;
    assigneeName: string;
    daysSinceSession: number | null;
  }[] = [];
  const debtors: {
    enrollmentId: string;
    studentName: string;
    phaseLabel: string;
    assigneeName: string;
    qbBalance: number;
  }[] = [];

  for (const enrollment of enrollments) {
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

    const phaseLabel = enrollment.currentPhase?.label ?? "—";
    const assigneeName = enrollment.assignedTo?.name ?? "—";
    const studentName = enrollment.customer.name;

    // Flagged students (SLA expiring OR no recent session)
    if (slaExpiring || noRecentSession) {
      const flags: { type: FlagType; daysRemaining?: number; daysSinceSession?: number }[] = [];
      if (slaExpiring) flags.push({ type: "sla_expiring", daysRemaining });
      if (noRecentSession) {
        flags.push({
          type: "no_recent_session",
          daysSinceSession: daysSinceSession === Infinity ? undefined : daysSinceSession,
        });
      }
      flagged.push({
        enrollmentId: enrollment.id,
        studentName,
        customerId: enrollment.customer.id,
        phaseLabel,
        assigneeName,
        flags,
        _sort: { slaExpiring, daysRemaining },
      });
    }

    // No-session students
    if (daysSinceSession >= NO_SESSION_THRESHOLD_DAYS) {
      noSessionStudents.push({
        enrollmentId: enrollment.id,
        studentName,
        phaseLabel,
        assigneeName,
        daysSinceSession: daysSinceSession === Infinity ? null : daysSinceSession,
      });
    }

    // Debtors
    const qbBalance = Number(enrollment.customer.qbBalance ?? 0);
    if (qbBalance > 0) {
      debtors.push({
        enrollmentId: enrollment.id,
        studentName,
        phaseLabel,
        assigneeName,
        qbBalance,
      });
    }
  }

  // Sort flagged: SLA-flagged first, then by daysRemaining ascending
  flagged.sort((a, b) => {
    const aHasSla = a._sort.slaExpiring ? 1 : 0;
    const bHasSla = b._sort.slaExpiring ? 1 : 0;
    if (aHasSla !== bHasSla) return bHasSla - aHasSla;
    return a._sort.daysRemaining - b._sort.daysRemaining;
  });

  const flaggedStudents = flagged.map(({ _sort: _ignored, ...rest }) => rest);

  return NextResponse.json({
    phaseDistribution: phases.map((p) => ({
      label: p.label,
      key: p.key,
      count: p._count.enrollments,
    })),
    flaggedStudents,
    flaggedCount: flaggedStudents.length,
    noSessionStudents,
    debtors,
  });
}
