import { prisma } from "@/lib/db";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
}

function lastMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return monthKey(date);
  });
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function displayOpsBiDocumentKind(kind: string) {
  const labels: Record<string, string> = {
    CV_ORIGINAL: "CV original",
    CV_FINAL: "CV final",
    COVER_LETTER_ORIGINAL: "Cover original",
    COVER_LETTER_FINAL: "Cover final",
    CANVA_LINK: "Canva",
    STUDENT_MATERIAL: "Material aluno",
    SUPPORT_MATERIAL: "Material suporte",
    CONTRACT_PDF: "Contrato",
    FORM_PDF: "Formulário",
  };
  return labels[kind] ?? kind.replaceAll("_", " ").toLowerCase();
}

export function displayOpsBiActivityStatus(status: string) {
  const labels: Record<string, string> = {
    APPLICATION: "Aplicação",
    INTERVIEW: "Entrevista",
    OFFER: "Oferta",
    JOB_PLACED: "Recolocação",
    EM_PROCESSO: "Em processo",
    PASSOU: "Passou",
    NAO_PASSOU: "Não passou",
    NO_SHOW: "No show",
    REMARCADO: "Remarcado",
    CANCELADO: "Cancelado",
    RECOLOCADO: "Recolocado",
  };
  return labels[status] ?? status.replaceAll("_", " ").toLowerCase();
}

export async function getOpsBiDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    enrollments,
    sessions,
    documents,
    activities,
    mockInterviews,
    pendingForms,
    npsAssignments,
  ] = await Promise.all([
    prisma.mentorshipEnrollment.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            qbBalance: true,
            formAssignments: {
              where: { status: { not: "COMPLETED" } },
              select: { id: true },
            },
          },
        },
        assignedTo: { select: { id: true, name: true } },
        currentPhase: { select: { id: true, key: true, label: true, slaDays: true } },
        transitions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        opsProfile: { select: { renewalDate: true } },
        sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
        checklistProgress: {
          where: { completedAt: { not: null } },
          select: { phaseKey: true, itemKey: true },
        },
      },
    }),
    prisma.mentorshipSession.findMany({
      where: { sessionDate: { gte: sixMonthsAgo } },
      include: {
        conductor: { select: { id: true, name: true } },
        enrollment: { select: { currentPhase: { select: { label: true } } } },
      },
    }),
    prisma.opsStudentDocument.findMany({
      where: { uploadedAt: { gte: sixMonthsAgo } },
      select: {
        kind: true,
        status: true,
        visibility: true,
        uploadedAt: true,
        finalizedAt: true,
        uploadedBy: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.opsStudentActivity.findMany({
      where: { activityDate: { gte: sixMonthsAgo } },
      select: {
        enrollmentId: true,
        type: true,
        status: true,
        industry: true,
        roleTitle: true,
        jobUrl: true,
        activityDate: true,
      },
    }).catch(() => []),
    prisma.aiMockInterviewSession.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { status: true, completedAt: true, createdAt: true },
    }),
    prisma.formAssignment.count({ where: { status: "PENDING" } }),
    prisma.formAssignment.findMany({
      where: { submission: { isNot: null } },
      select: {
        templateId: true,
        submission: { select: { answers: true, submittedAt: true } },
      },
    }),
  ]);

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "ACTIVE");
  const activeEnrollmentIds = new Set(activeEnrollments.map((enrollment) => enrollment.id));
  const activeActivities = activities.filter((activity) => activeEnrollmentIds.has(activity.enrollmentId));

  let overdueSlaCount = 0;
  let staleSessionCount = 0;
  let renewalSoonCount = 0;
  const riskRows = activeEnrollments
    .map((enrollment) => {
      const lastTransition = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
      const phaseAgeDays = Math.max(0, Math.floor((now.getTime() - new Date(lastTransition).getTime()) / 86_400_000));
      const daysSinceLastSession = enrollment.sessions[0]?.sessionDate
        ? Math.max(0, Math.floor((now.getTime() - new Date(enrollment.sessions[0].sessionDate).getTime()) / 86_400_000))
        : null;
      const overdueSla = Boolean(enrollment.currentPhase?.slaDays && phaseAgeDays > enrollment.currentPhase.slaDays);
      const staleSession = daysSinceLastSession === null || daysSinceLastSession >= 14;
      const debt = Number(enrollment.customer.qbBalance ?? 0);
      const renewalDate = enrollment.opsProfile?.renewalDate;
      const renewalInDays = renewalDate
        ? Math.ceil((new Date(renewalDate).getTime() - now.getTime()) / 86_400_000)
        : null;
      const renewalSoon = renewalInDays !== null && renewalInDays <= 30;
      if (overdueSla) overdueSlaCount += 1;
      if (staleSession) staleSessionCount += 1;
      if (renewalSoon) renewalSoonCount += 1;
      const riskScore =
        (overdueSla ? 35 : 0) +
        (staleSession ? 30 : 0) +
        (debt > 0 ? 15 : 0) +
        (renewalSoon ? 20 : 0);

      return {
        enrollmentId: enrollment.id,
        studentName: enrollment.customer.name,
        phase: enrollment.currentPhase?.label ?? "Sem fase",
        owner: enrollment.assignedTo.name,
        riskScore,
        phaseAgeDays,
        daysSinceLastSession,
        debt,
        renewalInDays,
      };
    })
    .filter((row) => row.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore);

  const monthKeys = lastMonthKeys(6);
  const sessionsByMonth = new Map(monthKeys.map((key) => [key, 0]));
  const mockByMonth = new Map(monthKeys.map((key) => [key, 0]));
  const placementsByMonth = new Map(monthKeys.map((key) => [key, 0]));

  sessions.forEach((session) => increment(sessionsByMonth, monthKey(session.sessionDate)));
  mockInterviews.forEach((mock) => increment(mockByMonth, monthKey(mock.completedAt ?? mock.createdAt)));
  activities
    .filter((activity) => activity.type === "JOB_PLACED" || activity.status === "RECOLOCADO")
    .forEach((activity) => increment(placementsByMonth, monthKey(activity.activityDate)));

  const trend = monthKeys.map((key) => ({
    month: monthLabel(key),
    sessions: sessionsByMonth.get(key) ?? 0,
    mocks: mockByMonth.get(key) ?? 0,
    placements: placementsByMonth.get(key) ?? 0,
  }));

  const phaseMap = new Map<string, { phase: string; active: number; risk: number }>();
  activeEnrollments.forEach((enrollment) => {
    const label = enrollment.currentPhase?.label ?? "Sem fase";
    const current = phaseMap.get(label) ?? { phase: label, active: 0, risk: 0 };
    current.active += 1;
    if (riskRows.some((row) => row.enrollmentId === enrollment.id)) current.risk += 1;
    phaseMap.set(label, current);
  });

  const documentMap = new Map<string, number>();
  documents.forEach((document) => increment(documentMap, displayOpsBiDocumentKind(document.kind)));

  const deliverablesByOwnerMap = new Map<string, { owner: string; total: number; final: number; public: number }>();
  documents.forEach((document) => {
    const owner = document.uploadedBy?.name ?? "Sem responsável";
    const current = deliverablesByOwnerMap.get(owner) ?? { owner, total: 0, final: 0, public: 0 };
    current.total += 1;
    if (document.status === "FINAL" || document.finalizedAt) current.final += 1;
    if (document.visibility === "STUDENT_VISIBLE") current.public += 1;
    deliverablesByOwnerMap.set(owner, current);
  });

  const activityStatusMap = new Map<string, number>();
  activities.forEach((activity) => increment(activityStatusMap, displayOpsBiActivityStatus(activity.status ?? activity.type)));

  const placementIndustryMap = new Map<string, number>();
  activities
    .filter((activity) => activity.type === "JOB_PLACED" || activity.status === "RECOLOCADO")
    .forEach((activity) => increment(placementIndustryMap, activity.industry || "Não classificada"));

  const applicationsMissingLink = activeActivities.filter(
    (activity) => activity.type === "APPLICATION" && !activity.jobUrl
  ).length;
  const interviewsMissingStatus = activeActivities.filter(
    (activity) => activity.type === "INTERVIEW" && !activity.status
  ).length;

  const workloadMap = new Map<string, { owner: string; sessions: number; students: number }>();
  activeEnrollments.forEach((enrollment) => {
    const owner = enrollment.assignedTo.name ?? "Sem responsável";
    const current = workloadMap.get(owner) ?? { owner, sessions: 0, students: 0 };
    current.students += 1;
    workloadMap.set(owner, current);
  });
  sessions.forEach((session) => {
    const owner = session.conductor.name ?? "Sem responsável";
    const current = workloadMap.get(owner) ?? { owner, sessions: 0, students: 0 };
    current.sessions += 1;
    workloadMap.set(owner, current);
  });

  const npsScores = npsAssignments
    .map((assignment) => {
      const answers = assignment.submission?.answers;
      if (!answers || typeof answers !== "object") return null;
      const possibleScore = Object.values(answers as Record<string, unknown>).find((value) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 && number <= 10;
      });
      const score = Number(possibleScore);
      return Number.isFinite(score) ? score : null;
    })
    .filter((score): score is number => score !== null);

  const sessionsThisMonth = sessions.filter((session) => session.sessionDate >= monthStart).length;
  const sessionsLast7Days = sessions.filter((session) => session.sessionDate >= weekStart).length;
  const noShows = sessions.filter((session) => session.status === "NO_SHOW").length;
  const rescheduled = sessions.filter((session) => session.status === "REMARCADO").length;
  const completedMocks = mockInterviews.filter((mock) => mock.status === "COMPLETED" || mock.completedAt).length;

  return {
    kpis: {
      activeStudents: activeEnrollments.length,
      pausedStudents: enrollments.filter((enrollment) => enrollment.status === "PAUSED").length,
      completedStudents: enrollments.filter((enrollment) => enrollment.status === "COMPLETED").length,
      atRiskStudents: riskRows.length,
      sessionsThisMonth,
      sessionsLast7Days,
      noShowRate: sessions.length ? Math.round((noShows / sessions.length) * 100) : 0,
      rescheduleRate: sessions.length ? Math.round((rescheduled / sessions.length) * 100) : 0,
      mockInterviews: mockInterviews.length,
      completedMocks,
      pendingForms,
      documentsDelivered: documents.filter((document) => document.status === "FINAL").length,
      placements: activities.filter((activity) => activity.type === "JOB_PLACED" || activity.status === "RECOLOCADO").length,
      averageNps: npsScores.length
        ? Math.round((npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length) * 10) / 10
        : null,
    },
    trend,
    phaseDistribution: Array.from(phaseMap.values()).sort((a, b) => b.active - a.active).slice(0, 12),
    documentMix: Array.from(documentMap.entries()).map(([name, value]) => ({ name, value })),
    activityStatusMix: Array.from(activityStatusMap.entries()).map(([name, value]) => ({ name, value })),
    criticalPendencies: [
      { name: "SLA vencido", value: overdueSlaCount, tone: "danger" as const },
      { name: "Sem sessão recente", value: staleSessionCount, tone: "warning" as const },
      { name: "Formulário pendente", value: pendingForms, tone: "warning" as const },
      { name: "Aplicação sem link", value: applicationsMissingLink, tone: "danger" as const },
      { name: "Entrevista sem status", value: interviewsMissingStatus, tone: "warning" as const },
      { name: "Renovação próxima", value: renewalSoonCount, tone: "info" as const },
    ],
    deliverablesByOwner: Array.from(deliverablesByOwnerMap.values())
      .sort((a, b) => b.final - a.final || b.total - a.total)
      .slice(0, 10),
    placementIndustries: Array.from(placementIndustryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    workload: Array.from(workloadMap.values()).sort((a, b) => b.students - a.students),
    riskRows: riskRows.slice(0, 12),
  };
}

export type OpsBiDashboard = Awaited<ReturnType<typeof getOpsBiDashboard>>;
