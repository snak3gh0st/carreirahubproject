import { AlertSeverity, AlertStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const OPS_MANUAL_STUDENT_COMMUNICATION_RULE = "Ops Manual Student Communication";

type OpsManualStudentCommunicationAlertInput = {
  customerId: string;
  customerName: string;
  customerEmail: string;
  title: string;
  description: string;
  severity?: AlertSeverity;
  dedupeKey: string;
  data?: Record<string, unknown>;
};

type OpsManualStudentCommunicationAlertPayload = {
  title: string;
  description: string;
  severity: AlertSeverity;
  customerId: string;
  data: Record<string, unknown>;
};

export function buildOpsManualStudentCommunicationAlert(
  input: OpsManualStudentCommunicationAlertInput
): OpsManualStudentCommunicationAlertPayload {
  return {
    title: input.title,
    description: input.description,
    severity: input.severity ?? AlertSeverity.MEDIUM,
    customerId: input.customerId,
    data: {
      channelPolicy: "MANUAL_ONLY",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      dedupeKey: input.dedupeKey,
      ...(input.data ?? {}),
    },
  };
}

export async function createOpsManualStudentCommunicationAlert(input: OpsManualStudentCommunicationAlertInput) {
  const rule = await prisma.alertRule.upsert({
    where: { name: OPS_MANUAL_STUDENT_COMMUNICATION_RULE },
    update: {
      description: "Internal alerts for student communication that must be handled manually by operations.",
      severity: AlertSeverity.MEDIUM,
      condition: "OPS_MANUAL_STUDENT_COMMUNICATION",
      enabled: true,
      checkInterval: "MANUAL",
      metadata: { source: "ops_internal_alerts" },
    },
    create: {
      name: OPS_MANUAL_STUDENT_COMMUNICATION_RULE,
      description: "Internal alerts for student communication that must be handled manually by operations.",
      severity: AlertSeverity.MEDIUM,
      condition: "OPS_MANUAL_STUDENT_COMMUNICATION",
      enabled: true,
      checkInterval: "MANUAL",
      metadata: { source: "ops_internal_alerts" },
    },
  });

  const alert = buildOpsManualStudentCommunicationAlert(input);
  const existing = await prisma.alert.findFirst({
    where: {
      ruleId: rule.id,
      customerId: input.customerId,
      status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      data: { path: ["dedupeKey"], equals: input.dedupeKey },
    },
  });

  if (existing) return { alert: existing, created: false };

  const createdAlert = await prisma.alert.create({
    data: {
      ruleId: rule.id,
      ...alert,
      data: alert.data as Prisma.InputJsonValue,
    },
  });

  return { alert: createdAlert, created: true };
}
