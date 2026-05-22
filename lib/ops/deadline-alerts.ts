import { AlertSeverity, AlertStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const OPS_DEADLINE_ALERT_RULE = "Ops Deadline and SLA Alert";

const DAY_MS = 86_400_000;
const SLA_WARNING_DAYS = 2;
const NO_SESSION_THRESHOLD_DAYS = 14;
const RENEWAL_WARNING_DAYS = 30;

type OpsDeadlineEnrollment = {
  id: string;
  startDate: Date;
  customer: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string | null } | null;
  currentPhase: { key: string; label: string; slaDays: number | null } | null;
  transitions: Array<{ createdAt: Date }>;
  sessions: Array<{ sessionDate: Date }>;
  opsProfile: { renewalDate: Date | null } | null;
};

export type OpsDeadlineAlertCandidate = {
  customerId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  dedupeKey: string;
  data: Record<string, unknown>;
};

function daysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

export function buildOpsDeadlineAlertCandidates(
  enrollments: OpsDeadlineEnrollment[],
  now = new Date()
): OpsDeadlineAlertCandidate[] {
  const candidates: OpsDeadlineAlertCandidate[] = [];

  for (const enrollment of enrollments) {
    const phase = enrollment.currentPhase;
    const lastTransitionDate = enrollment.transitions[0]?.createdAt ?? enrollment.startDate;
    const phaseAgeDays = daysBetween(lastTransitionDate, now);
    const phaseSlaDays = phase?.slaDays ?? null;
    const daysRemaining = phaseSlaDays === null ? null : phaseSlaDays - phaseAgeDays;
    const assigneeName = enrollment.assignedTo?.name ?? "Sem responsavel";

    if (daysRemaining !== null && daysRemaining <= SLA_WARNING_DAYS) {
      const isOverdue = daysRemaining < 0;
      candidates.push({
        customerId: enrollment.customer.id,
        title: `${isOverdue ? "SLA vencido" : "SLA proximo"}: ${enrollment.customer.name}`,
        description: `${enrollment.customer.name} esta na fase ${phase?.label ?? "sem fase"} ha ${phaseAgeDays} dia(s). Responsavel: ${assigneeName}.`,
        severity: isOverdue ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        dedupeKey: `sla:${enrollment.id}:${phase?.key ?? "none"}`,
        data: {
          source: "ops-deadline-alerts",
          alertType: "SLA",
          enrollmentId: enrollment.id,
          phaseKey: phase?.key ?? null,
          phaseLabel: phase?.label ?? null,
          phaseAgeDays,
          phaseSlaDays,
          daysRemaining,
          assigneeName,
        },
      });
    }

    const lastSessionDate = enrollment.sessions[0]?.sessionDate ?? null;
    const daysSinceLastSession = lastSessionDate ? daysBetween(lastSessionDate, now) : null;
    if (daysSinceLastSession === null || daysSinceLastSession >= NO_SESSION_THRESHOLD_DAYS) {
      candidates.push({
        customerId: enrollment.customer.id,
        title: `Sem sessao recente: ${enrollment.customer.name}`,
        description: daysSinceLastSession === null
          ? `${enrollment.customer.name} ainda nao tem sessao registrada. Responsavel: ${assigneeName}.`
          : `${enrollment.customer.name} esta ha ${daysSinceLastSession} dia(s) sem sessao registrada. Responsavel: ${assigneeName}.`,
        severity: AlertSeverity.MEDIUM,
        dedupeKey: `no-session:${enrollment.id}`,
        data: {
          source: "ops-deadline-alerts",
          alertType: "NO_RECENT_SESSION",
          enrollmentId: enrollment.id,
          daysSinceLastSession,
          lastSessionDate: lastSessionDate?.toISOString() ?? null,
          assigneeName,
        },
      });
    }

    const renewalDate = enrollment.opsProfile?.renewalDate ?? null;
    const renewalInDays = renewalDate ? Math.ceil((renewalDate.getTime() - now.getTime()) / DAY_MS) : null;
    if (renewalDate && renewalInDays !== null && renewalInDays <= RENEWAL_WARNING_DAYS) {
      candidates.push({
        customerId: enrollment.customer.id,
        title: `Renovacao exige acao: ${enrollment.customer.name}`,
        description: `${enrollment.customer.name} tem renovacao em ${renewalInDays} dia(s). Comunicacao deve ser manual e contextualizada.`,
        severity: renewalInDays < 0 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        dedupeKey: `renewal:${enrollment.id}:${renewalDate.toISOString().slice(0, 10)}`,
        data: {
          source: "ops-deadline-alerts",
          alertType: "RENEWAL",
          channelPolicy: "MANUAL_ONLY",
          enrollmentId: enrollment.id,
          renewalDate: renewalDate.toISOString(),
          renewalInDays,
          assigneeName,
        },
      });
    }
  }

  return candidates;
}

export async function createOpsDeadlineAlerts(now = new Date()) {
  const rule = await prisma.alertRule.upsert({
    where: { name: OPS_DEADLINE_ALERT_RULE },
    update: {
      description: "Internal operational alerts for SLA, stale sessions, and renewal deadlines.",
      severity: AlertSeverity.MEDIUM,
      condition: "OPS_DEADLINE_ALERTS",
      enabled: true,
      checkInterval: "DAILY",
      metadata: { source: "ops_deadline_alerts" },
    },
    create: {
      name: OPS_DEADLINE_ALERT_RULE,
      description: "Internal operational alerts for SLA, stale sessions, and renewal deadlines.",
      severity: AlertSeverity.MEDIUM,
      condition: "OPS_DEADLINE_ALERTS",
      enabled: true,
      checkInterval: "DAILY",
      metadata: { source: "ops_deadline_alerts" },
    },
  });

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      startDate: true,
      customer: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      currentPhase: { select: { key: true, label: true, slaDays: true } },
      transitions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
      opsProfile: { select: { renewalDate: true } },
    },
  });

  const candidates = buildOpsDeadlineAlertCandidates(enrollments, now);
  let created = 0;
  let skippedExisting = 0;

  for (const candidate of candidates) {
    const existing = await prisma.alert.findFirst({
      where: {
        ruleId: rule.id,
        customerId: candidate.customerId,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        data: { path: ["dedupeKey"], equals: candidate.dedupeKey },
      },
    });

    if (existing) {
      skippedExisting++;
      continue;
    }

    await prisma.alert.create({
      data: {
        ruleId: rule.id,
        customerId: candidate.customerId,
        title: candidate.title,
        description: candidate.description,
        severity: candidate.severity,
        data: {
          ...candidate.data,
          dedupeKey: candidate.dedupeKey,
        } as Prisma.InputJsonValue,
      },
    });
    created++;
  }

  return { evaluated: enrollments.length, candidates: candidates.length, created, skippedExisting };
}
