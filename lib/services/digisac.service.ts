import { OpsDigisacMessageDirection } from "@prisma/client";

type DigisacConfig = {
  apiBaseUrl: string | null;
  apiToken: string | null;
  serviceId: string | null;
  workspaceUrl: string | null;
  defaultCountryCode: string;
  missing: string[];
  enabled: boolean;
};

type DigisacSendMessageInput = {
  number: string;
  text: string;
  serviceId?: string | null;
  dontOpenTicket?: boolean;
};

type DigisacWebhookMessage = {
  externalId: string | null;
  contactId: string | null;
  contactName: string | null;
  ticketId: string | null;
  serviceId: string | null;
  phoneNumber: string | null;
  content: string;
  type: string | null;
  status: string | null;
  direction: OpsDigisacMessageDirection;
  externalCreatedAt: Date | null;
  raw: unknown;
};

function trimTrailingSlash(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function firstObject(...values: unknown[]) {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, any>;
    }
  }
  return {};
}

function parseDate(value: unknown) {
  const raw = firstString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDigisacConfig(): DigisacConfig {
  const apiBaseUrl = trimTrailingSlash(process.env.DIGISAC_API_BASE_URL);
  const apiToken = process.env.DIGISAC_API_TOKEN?.trim() || null;
  const serviceId = process.env.DIGISAC_SERVICE_ID?.trim() || null;
  const workspaceUrl =
    trimTrailingSlash(process.env.DIGISAC_WORKSPACE_URL) ??
    apiBaseUrl?.replace(/\/api\/v1$/i, "") ??
    null;
  const defaultCountryCode = (process.env.DIGISAC_DEFAULT_COUNTRY_CODE || "55").replace(/\D/g, "") || "55";
  const missing = [
    !apiBaseUrl ? "DIGISAC_API_BASE_URL" : null,
    !apiToken ? "DIGISAC_API_TOKEN" : null,
    !serviceId ? "DIGISAC_SERVICE_ID" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    apiBaseUrl,
    apiToken,
    serviceId,
    workspaceUrl,
    defaultCountryCode,
    missing,
    enabled: missing.length === 0,
  };
}

export function normalizePhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

export function formatDigisacPhone(value: string, defaultCountryCode = getDigisacConfig().defaultCountryCode) {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.length <= 11 && defaultCountryCode) return `${defaultCountryCode}${digits}`;
  return digits;
}

export function buildDigisacContactUrl(contactId: string | null | undefined) {
  if (!contactId) return null;
  const config = getDigisacConfig();
  if (!config.workspaceUrl) return null;
  return `${config.workspaceUrl}/contacts/${contactId}`;
}

export async function sendDigisacMessage(input: DigisacSendMessageInput) {
  const config = getDigisacConfig();
  if (!config.enabled || !config.apiBaseUrl || !config.apiToken || !config.serviceId) {
    throw new Error(`Digisac nao configurado: ${config.missing.join(", ")}`);
  }

  const text = input.text.trim();
  const number = formatDigisacPhone(input.number, config.defaultCountryCode);
  if (!text) throw new Error("Mensagem vazia");
  if (!number) throw new Error("Aluno sem telefone valido");

  const response = await fetch(`${config.apiBaseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify({
      text,
      number,
      serviceId: input.serviceId || config.serviceId,
      origin: "bot",
      dontOpenTicket: Boolean(input.dontOpenTicket),
    }),
  });

  const rawText = await response.text();
  let data: any = rawText;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Digisac respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }

  return {
    externalId: firstString(data?.id, data?.messageId, data?.data?.id, data?.message?.id),
    contactId: firstString(data?.contactId, data?.contact?.id, data?.data?.contactId, data?.data?.contact?.id),
    ticketId: firstString(data?.ticketId, data?.ticket?.id, data?.data?.ticketId, data?.data?.ticket?.id),
    serviceId: firstString(data?.serviceId, data?.service?.id, input.serviceId, config.serviceId),
    status: firstString(data?.status, data?.data?.status),
    raw: data,
  };
}

export function extractDigisacWebhookMessage(payload: unknown): DigisacWebhookMessage | null {
  const root = firstObject(payload);
  const data = firstObject(root.data, root.message, root.payload, root);
  const message = firstObject(data.message, data.lastMessage, data);
  const contact = firstObject(message.contact, data.contact, data.person, data.ticket?.contact, root.contact);
  const ticket = firstObject(message.ticket, data.ticket, root.ticket);
  const service = firstObject(message.service, data.service, root.service);
  const event = firstString(root.event, root.type, data.event, data.type) ?? "";

  const content =
    firstString(
      message.text,
      message.body,
      message.content,
      message.caption,
      message.message,
      data.text,
      data.body,
      data.content
    ) ?? "[mensagem sem texto]";

  const phoneNumber = firstString(
    message.number,
    message.phone,
    message.from,
    message.to,
    data.number,
    data.phone,
    contact.number,
    contact.phone,
    contact.mobile,
    contact.whatsapp
  );

  const externalId = firstString(message.id, message.messageId, message.externalId, data.id, data.messageId);
  const fromMe = Boolean(message.fromMe ?? message.isFromMe ?? data.fromMe ?? data.isFromMe);
  const origin = firstString(message.origin, data.origin);
  const direction =
    fromMe || origin === "bot" || origin === "agent" || /sent|outbound|send/i.test(event)
      ? OpsDigisacMessageDirection.OUTBOUND
      : OpsDigisacMessageDirection.INBOUND;

  if (!phoneNumber && !firstString(contact.id, data.contactId, message.contactId)) {
    return null;
  }

  return {
    externalId,
    contactId: firstString(contact.id, data.contactId, message.contactId),
    contactName: firstString(contact.name, contact.displayName, data.contactName),
    ticketId: firstString(ticket.id, data.ticketId, message.ticketId),
    serviceId: firstString(service.id, data.serviceId, message.serviceId),
    phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : null,
    content,
    type: firstString(message.type, data.messageType, data.type),
    status: firstString(message.status, data.status),
    direction,
    externalCreatedAt: parseDate(message.createdAt ?? message.timestamp ?? data.createdAt ?? data.timestamp),
    raw: payload,
  };
}
