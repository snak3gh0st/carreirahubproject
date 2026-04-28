// app/api/ops/my-tasks/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // ADMIN sees all active enrollments; others see only their assigned phases.
  const phaseFilter = userRole === "ADMIN"
    ? {}
    : { currentPhase: { key: { in: user.assignedPhases } } };

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: { status: "ACTIVE", ...phaseFilter },
    include: {
      customer: { select: { name: true } },
      currentPhase: { select: { key: true, label: true } },
      sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
      _count: { select: { sessions: true } },
      checklistProgress: { where: { completedAt: { not: null } }, select: { phaseKey: true, itemKey: true, completedAt: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const now = Date.now();

  const result = enrollments.map((e) => {
    const phaseKey = e.currentPhase?.key ?? "";
    const template = getPhaseChecklist(phaseKey);
    const completedKeys = new Set(
      e.checklistProgress
        .filter((p) => p.phaseKey === phaseKey && p.completedAt !== null)
        .map((p) => p.itemKey)
    );

    const lastSessionDate = e.sessions[0]?.sessionDate ?? null;
    const daysSinceLastSession = lastSessionDate
      ? Math.floor((now - new Date(lastSessionDate).getTime()) / 86400000)
      : null;

    return {
      enrollmentId: e.id,
      studentName: e.customer.name,
      programType: e.programType,
      phaseKey,
      phaseLabel: e.currentPhase?.label ?? phaseKey,
      assigneeName: e.assignedTo?.name ?? null,
      startDate: e.startDate.toISOString(),
      sessionCount: e._count.sessions,
      daysSinceLastSession,
      checklistProgress: {
        completed: template.filter((i) => completedKeys.has(i.key)).length,
        total: template.length,
        items: template.map((item) => ({
          key: item.key,
          label: item.label,
          type: item.type,
          autoComplete: item.autoComplete ?? false,
          requiresAll: item.requiresAll ?? false,
          completedAt: e.checklistProgress.find(
            (p) => p.phaseKey === phaseKey && p.itemKey === item.key
          )?.completedAt?.toISOString() ?? null,
        })),
      },
    };
  });

  // Sort: most urgent first — 0% progress, then most days since last session
  result.sort((a, b) => {
    const aPct = a.checklistProgress.total > 0
      ? a.checklistProgress.completed / a.checklistProgress.total : 0;
    const bPct = b.checklistProgress.total > 0
      ? b.checklistProgress.completed / b.checklistProgress.total : 0;
    if (aPct !== bPct) return aPct - bPct;
    return (b.daysSinceLastSession ?? 0) - (a.daysSinceLastSession ?? 0);
  });

  return NextResponse.json({ enrollments: result });
}
