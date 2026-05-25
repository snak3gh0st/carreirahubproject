import type { CollectionCallStatus } from "@prisma/client";

export const COLLECTION_CALL_PROVIDER = "TWILIO_OPENAI_REALTIME";
export const COLLECTION_CALL_DEFAULT_MODEL = "gpt-realtime-2";
export const COLLECTION_CALL_DEFAULT_VOICE = "marin";

export type CollectionVoiceEnv = Record<string, string | undefined>;

export interface CollectionCallAcceptPayloadInput {
  model?: string;
  voice?: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: number;
  daysOverdue: number;
  paymentUrl?: string;
}

export interface CollectionCallOpenAiAcceptPayload {
  type: "realtime";
  model: string;
  instructions: string;
  audio: {
    output: {
      voice: string;
    };
    input: {
      turn_detection: {
        type: "semantic_vad";
      };
    };
  };
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeCollectionPhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/\D/g, "")}`;
  }

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = `55${digits}`;
  }
  return `+${digits}`;
}

export function getCollectionCallPublicBaseUrl(env: CollectionVoiceEnv = process.env): string | null {
  const url = clean(env.COLLECTION_CALL_PUBLIC_BASE_URL) ?? clean(env.NEXT_PUBLIC_APP_URL);
  return url ? url.replace(/\/+$/, "") : null;
}

export function isCollectionVoiceConfigured(env: CollectionVoiceEnv = process.env): boolean {
  return Boolean(
    clean(env.TWILIO_ACCOUNT_SID) &&
      clean(env.TWILIO_AUTH_TOKEN) &&
      clean(env.TWILIO_PHONE_NUMBER) &&
      getCollectionCallPublicBaseUrl(env) &&
      (clean(env.OPENAI_REALTIME_API_KEY) || clean(env.OPENAI_API_KEY)) &&
      clean(env.OPENAI_PROJECT_ID)
  );
}

export function buildCollectionCallTwimlUrl(baseUrl: string, collectionCallId: string): string {
  const url = new URL("/api/webhooks/collection-calls/twilio/twiml", baseUrl);
  url.searchParams.set("collectionCallId", collectionCallId);
  return url.toString();
}

export function buildCollectionCallStatusCallbackUrl(baseUrl: string, collectionCallId: string): string {
  const url = new URL("/api/webhooks/collection-calls/twilio/status", baseUrl);
  url.searchParams.set("collectionCallId", collectionCallId);
  return url.toString();
}

export function buildCollectionCallSipUri(input: {
  projectId: string;
  collectionCallId: string;
}): string {
  const projectId = encodeURIComponent(input.projectId);
  const collectionCallId = encodeURIComponent(input.collectionCallId);
  return `sip:${projectId}@sip.api.openai.com;transport=tls?X-Collection-Call-Id=${collectionCallId}`;
}

export function mapTwilioCallStatus(status: string | null | undefined): CollectionCallStatus {
  switch ((status ?? "").toLowerCase()) {
    case "queued":
    case "initiated":
      return "PENDING" as CollectionCallStatus;
    case "ringing":
    case "answered":
    case "in-progress":
      return "IN_PROGRESS" as CollectionCallStatus;
    case "completed":
      return "COMPLETED" as CollectionCallStatus;
    case "busy":
      return "BUSY" as CollectionCallStatus;
    case "no-answer":
      return "NO_ANSWER" as CollectionCallStatus;
    case "canceled":
      return "CANCELLED" as CollectionCallStatus;
    case "failed":
    default:
      return "FAILED" as CollectionCallStatus;
  }
}

export function formatCurrencyBRL(amount: number): string {
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).replace(/\u00a0/g, " ");
}

export function buildCollectionCallOpenAiAcceptPayload(
  input: CollectionCallAcceptPayloadInput
): CollectionCallOpenAiAcceptPayload {
  const amount = formatCurrencyBRL(input.amountDue);
  const invoice = input.invoiceNumber;
  const paymentUrl = input.paymentUrl
    ? `Link de pagamento: ${input.paymentUrl}`
    : "Se o cliente quiser pagar agora, confirme que a equipe enviara o link de pagamento pelo WhatsApp ou email.";

  return {
    type: "realtime",
    model: input.model || COLLECTION_CALL_DEFAULT_MODEL,
    instructions: [
      "Voce e um assistente de cobranca da Carreira USA. Fale em portugues brasileiro, com tom profissional, calmo e respeitoso.",
      `Cliente: ${input.customerName}. Fatura: ${invoice}. Valor em aberto: ${amount}. Atraso: ${input.daysOverdue} dias.`,
      paymentUrl,
      "Objetivo: confirmar se o cliente reconhece a pendencia, oferecer o link de pagamento, entender objeções simples e registrar promessa de pagamento quando houver.",
      "Nunca ameace, nunca use linguagem agressiva, nunca prometa desconto ou acordo que nao esteja explicitamente autorizado no contexto.",
      "Se houver disputa, confusao, pedido de renegociacao, vulnerabilidade financeira sensivel, pedido de falar com pessoa, ou irritacao do cliente, diga que fara handoff humano para o time financeiro.",
      "Se cair em caixa postal, deixe uma mensagem curta pedindo retorno pelo WhatsApp ou portal do cliente.",
    ].join("\n"),
    audio: {
      output: {
        voice: input.voice || COLLECTION_CALL_DEFAULT_VOICE,
      },
      input: {
        turn_detection: {
          type: "semantic_vad",
        },
      },
    },
  };
}
