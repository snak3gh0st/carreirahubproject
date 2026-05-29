import { Prisma } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db";
import { storeOutboundDigisacMessage as defaultStoreOutboundDigisacMessage } from "@/lib/ops/digisac-store";
import {
  getDigisacConfig as defaultGetDigisacConfig,
  sendDigisacMessage as defaultSendDigisacMessage,
} from "@/lib/services/digisac.service";

export const DIGISAC_LIFECYCLE_DEFAULT_START_AT = "2026-05-25T00:00:00.000Z";
export const DIGISAC_LIFECYCLE_SUCCESS_ACTION = "LIFECYCLE_MESSAGE_SENT";
export const DIGISAC_LIFECYCLE_FAILED_ACTION = "LIFECYCLE_MESSAGE_FAILED";
export const DIGISAC_LIFECYCLE_SIGNATURE = "Suporte Carreira USA";

export type DigisacLifecycleEvent =
  | "program_welcome"
  | "form_assigned"
  | "document_available"
  | "english_test_ready"
  | "renewal_reminder"
  | "session_scheduled";

export type DigisacLifecycleRenewalMilestone = "30" | "15" | "7";

export interface DigisacLifecycleMessageInput {
  event: DigisacLifecycleEvent;
  customerName: string | null;
  hubUrl: string;
  title?: string | null;
  programType?: string | null;
  daysUntilRenewal?: number | null;
  renewalDate?: Date | null;
  sessionDate?: Date | null;
  sessionType?: string | null;
  conductorName?: string | null;
}

export interface SendDigisacLifecycleInput {
  event: DigisacLifecycleEvent;
  enrollmentId: string;
  dedupeKey: string;
  title?: string | null;
  metadata?: Record<string, unknown>;
  daysUntilRenewal?: number | null;
  renewalDate?: Date | null;
  sessionDate?: Date | null;
  sessionType?: string | null;
  conductorName?: string | null;
  /** Bypass the global lifecycle lock (explicit manual ops sends only). */
  force?: boolean;
}

export interface DigisacLifecycleSendResult {
  sent: boolean;
  skippedReason?: "disabled" | "not_configured" | "duplicate" | "missing_enrollment" | "missing_phone" | "send_failed" | "locked";
  messageId?: string | null;
}

type DigisacConfig = {
  apiBaseUrl: string | null;
  apiToken: string | null;
  serviceId: string | null;
  workspaceUrl: string | null;
  defaultCountryCode: string;
  missing: string[];
  enabled: boolean;
};

type SendMessageInput = {
  number: string;
  text: string;
  serviceId?: string | null;
  dontOpenTicket?: boolean;
};

type SendMessageResult = {
  externalId: string | null;
  contactId: string | null;
  ticketId: string | null;
  serviceId: string | null;
  status: string | null;
  raw: unknown;
};

type StoreOutboundInput = {
  enrollmentId: string;
  sentById?: string | null;
  text: string;
  result: SendMessageResult;
};

export interface SendDigisacLifecycleDeps {
  env?: Record<string, string | undefined>;
  prisma?: {
    integrationLog: {
      findFirst(args: any): Promise<any>;
      create(args: any): Promise<any>;
    };
    mentorshipEnrollment: {
      findUnique(args: any): Promise<any>;
    };
  };
  getConfig?: () => DigisacConfig;
  sendMessage?: (input: SendMessageInput) => Promise<SendMessageResult>;
  storeOutbound?: (input: StoreOutboundInput) => Promise<unknown>;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstName(name: string | null | undefined): string {
  const cleaned = clean(name ?? undefined);
  return cleaned?.split(/\s+/)[0] ?? "tudo bem";
}

function normalizeBaseUrl(raw: string | undefined): string {
  return (clean(raw) ?? "https://app.carreirausa.com").replace(/\/+$/, "");
}

export function getDigisacLifecycleHubUrl(env: Record<string, string | undefined> = process.env): string {
  const explicitHubUrl = clean(env.DIGISAC_LIFECYCLE_HUB_URL);
  if (explicitHubUrl) {
    return explicitHubUrl.replace(/\/+$/, "");
  }

  const baseUrl = normalizeBaseUrl(env.NEXT_PUBLIC_APP_URL);
  return `${baseUrl}/hub/login`;
}

export function isDigisacLifecycleAutomationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = clean(env.DIGISAC_LIFECYCLE_AUTOMATIONS_ENABLED)?.toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

export function getDigisacLifecycleStartAt(
  env: Record<string, string | undefined> = process.env
): Date {
  const candidate = clean(env.DIGISAC_LIFECYCLE_START_AT) ?? DIGISAC_LIFECYCLE_DEFAULT_START_AT;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(DIGISAC_LIFECYCLE_DEFAULT_START_AT);
  }
  return parsed;
}

export function isEligibleForDigisacLifecycleBackfillProtection(input: {
  createdAt: Date;
  env?: Record<string, string | undefined>;
}): boolean {
  return input.createdAt.getTime() >= getDigisacLifecycleStartAt(input.env).getTime();
}

export function getDigisacLifecycleRenewalMilestone(
  daysUntilRenewal: number
): DigisacLifecycleRenewalMilestone | null {
  if (daysUntilRenewal <= 0 || daysUntilRenewal > 30) return null;
  if (daysUntilRenewal <= 7) return "7";
  if (daysUntilRenewal <= 15) return "15";
  return "30";
}

export function buildDigisacLifecycleDedupeKey(event: DigisacLifecycleEvent, id: string): string {
  return `digisac:lifecycle:${event}:${id}`;
}

function appendSignature(body: string): string {
  return `${body}\n\n— ${DIGISAC_LIFECYCLE_SIGNATURE}`;
}

export function buildDigisacLifecycleMessage(input: DigisacLifecycleMessageInput): string {
  const name = firstName(input.customerName);
  const title = clean(input.title ?? undefined);

  const body = (() => {
  switch (input.event) {
    case "program_welcome":
      return [
        `Olá ${name}, parabéns por ter tomado a decisão de entrar para o programa da Carreira USA.`,
        "A partir de agora vamos acompanhar sua jornada pelo Hub, nossa plataforma, e pelo WhatsApp. Por isso, o time já entrará em contato com você!",
        `Acesse seu Hub por aqui: ${input.hubUrl} e tenha acesso a todo o seu processo, dados, financeiro e outras informações importantes.`,
        "Se ainda nao tiver acesso, responda esta mensagem e nosso time ajuda.",
        "Abraços,\nSuporte Carreira USA.",
      ].join("\n\n");
    case "form_assigned":
      return [
        `Ola, ${name}! Um novo formulario foi disponibilizado para voce${title ? `: ${title}` : "."}`,
        "Quando puder, acesse o Hub e preencha com atencao para darmos continuidade ao seu processo.",
        `Hub: ${input.hubUrl}`,
        "Se ainda nao tiver acesso, responda esta mensagem e nosso time ajuda.",
      ].join("\n\n");
    case "document_available":
      return [
        `Ola, ${name}! Um novo documento/material foi disponibilizado para voce${title ? `: ${title}` : "."}`,
        "Ele ja esta no seu Hub para consulta.",
        `Hub: ${input.hubUrl}`,
        "Se ainda nao tiver acesso, responda esta mensagem e nosso time ajuda.",
      ].join("\n\n");
    case "english_test_ready":
      return [
        `Ola, ${name}! Sua etapa de teste de ingles esta pronta para continuidade.`,
        title ? `Referencia: ${title}` : "Entre no Hub para ver as orientacoes e proximos passos.",
        `Hub: ${input.hubUrl}`,
        "Se ainda nao tiver acesso, responda esta mensagem e nosso time ajuda.",
      ].join("\n\n");
    case "renewal_reminder": {
      const days = input.daysUntilRenewal ?? null;
      const dateText = input.renewalDate
        ? input.renewalDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : null;
      const deadline = days !== null
        ? `em ${days} dia(s)`
        : dateText
          ? `em ${dateText}`
          : "em breve";
      return [
        `Ola, ${name}! Sua renovacao da mentoria Carreira USA esta se aproximando ${deadline}.`,
        "Nosso time vai acompanhar os proximos passos com voce por aqui.",
        `Hub: ${input.hubUrl}`,
      ].join("\n\n");
    }
    case "session_scheduled": {
      const dateText = input.sessionDate
        ? input.sessionDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })
        : "em breve";
      const timeText = input.sessionDate
        ? input.sessionDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const type = clean(input.sessionType ?? undefined);
      const conductor = clean(input.conductorName ?? undefined);
      return [
        `Ola, ${name}! Voce tem uma sessao agendada${type ? ` de ${type}` : ""}.`,
        `Data: ${dateText}${timeText ? ` as ${timeText}` : ""}${conductor ? ` com ${conductor}` : ""}.`,
        "Voce pode acompanhar o agendamento no seu Hub.",
        `Hub: ${input.hubUrl}`,
      ].join("\n\n");
    }
  }
  })();

  // program_welcome carries its own sign-off ("Abraços, Suporte Carreira USA"),
  // so skip the appended signature to avoid duplicating it.
  return input.event === "program_welcome" ? body : appendSignature(body);
}

function wrapRawPayload(input: {
  raw: unknown;
  event: DigisacLifecycleEvent;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}): Prisma.InputJsonValue {
  return {
    provider: input.raw as Prisma.InputJsonValue,
    automation: {
      source: "digisac_lifecycle",
      event: input.event,
      dedupeKey: input.dedupeKey,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  } as Prisma.InputJsonValue;
}

async function logLifecycleFailure(input: {
  prismaClient: NonNullable<SendDigisacLifecycleDeps["prisma"]>;
  lifecycle: SendDigisacLifecycleInput;
  error: unknown;
}) {
  await input.prismaClient.integrationLog.create({
    data: {
      service: "DIGISAC",
      action: DIGISAC_LIFECYCLE_FAILED_ACTION,
      status: "ERROR",
      error: input.error instanceof Error ? input.error.message : String(input.error),
      payload: {
        event: input.lifecycle.event,
        enrollmentId: input.lifecycle.enrollmentId,
        dedupeKey: input.lifecycle.dedupeKey,
        metadata: input.lifecycle.metadata ?? {},
      } as Prisma.InputJsonValue,
    },
  }).catch(() => {});
}

export async function sendDigisacLifecycleMessage(
  input: SendDigisacLifecycleInput,
  deps: SendDigisacLifecycleDeps = {}
): Promise<DigisacLifecycleSendResult> {
  const env = deps.env ?? process.env;
  if (!isDigisacLifecycleAutomationEnabled(env)) {
    return { sent: false, skippedReason: "disabled" };
  }

  const config = (deps.getConfig ?? defaultGetDigisacConfig)();
  if (!config.enabled || !config.serviceId) {
    return { sent: false, skippedReason: "not_configured" };
  }

  const prismaClient = deps.prisma ?? defaultPrisma;
  const existing = await prismaClient.integrationLog.findFirst({
    where: {
      service: "DIGISAC",
      action: DIGISAC_LIFECYCLE_SUCCESS_ACTION,
      status: "SUCCESS",
      payload: { path: ["dedupeKey"], equals: input.dedupeKey },
    },
  });
  if (existing) {
    return { sent: false, skippedReason: "duplicate" };
  }

  const enrollment = await prismaClient.mentorshipEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      id: true,
      programType: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!enrollment) {
    return { sent: false, skippedReason: "missing_enrollment" };
  }
  if (!enrollment.customer.phone) {
    return { sent: false, skippedReason: "missing_phone" };
  }

  const text = buildDigisacLifecycleMessage({
    event: input.event,
    customerName: enrollment.customer.name,
    hubUrl: getDigisacLifecycleHubUrl(env),
    title: input.title,
    programType: enrollment.programType,
    daysUntilRenewal: input.daysUntilRenewal,
    renewalDate: input.renewalDate,
    sessionDate: input.sessionDate,
    sessionType: input.sessionType,
    conductorName: input.conductorName,
  });

  try {
    const sendMessage = deps.sendMessage ?? defaultSendDigisacMessage;
    const result = await sendMessage({
      number: enrollment.customer.phone,
      text,
      serviceId: config.serviceId,
      dontOpenTicket: false,
    });

    const wrappedResult = {
      ...result,
      raw: wrapRawPayload({
        raw: result.raw,
        event: input.event,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata,
      }),
    };

    const storeOutbound = deps.storeOutbound ?? defaultStoreOutboundDigisacMessage;
    await storeOutbound({
      enrollmentId: input.enrollmentId,
      sentById: null,
      text,
      result: wrappedResult,
    });

    await prismaClient.integrationLog.create({
      data: {
        service: "DIGISAC",
        action: DIGISAC_LIFECYCLE_SUCCESS_ACTION,
        status: "SUCCESS",
        payload: {
          event: input.event,
          enrollmentId: input.enrollmentId,
          customerId: enrollment.customer.id,
          dedupeKey: input.dedupeKey,
          externalId: result.externalId,
          metadata: input.metadata ?? {},
        } as Prisma.InputJsonValue,
      },
    });

    return { sent: true, messageId: result.externalId };
  } catch (error) {
    await logLifecycleFailure({ prismaClient, lifecycle: input, error });
    return { sent: false, skippedReason: "send_failed" };
  }
}

export async function sendDigisacLifecycleMessageSafely(
  input: SendDigisacLifecycleInput
): Promise<DigisacLifecycleSendResult> {
  // [TEST PHASE LOCK] Global kill-switch for AUTOMATIC lifecycle messages.
  // Students who changed products were still receiving these. Locked by default;
  // set DIGISAC_LIFECYCLE_ENABLED=true to resume automatic sends. Explicit manual
  // ops sends (e.g. send-hub-access) pass force=true and are never locked.
  if (!input.force && process.env.DIGISAC_LIFECYCLE_ENABLED !== "true") {
    console.warn(`[DIGISAC_LIFECYCLE] Locked — skipping ${input.event} (set DIGISAC_LIFECYCLE_ENABLED=true to resume)`);
    return { sent: false, skippedReason: "locked" };
  }
  try {
    return await sendDigisacLifecycleMessage(input);
  } catch (error) {
    console.warn("[DIGISAC_LIFECYCLE] Failed to send lifecycle message:", error);
    return { sent: false, skippedReason: "send_failed" };
  }
}
