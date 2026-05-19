import type { Language } from "@/lib/i18n/hub";

export interface MicrophoneAccessErrorInput {
  name?: string;
  message?: string;
  secureContext: boolean;
  language: Language;
}

export interface RealtimeSessionErrorInput {
  status?: number;
  serverError?: string;
  language: Language;
}

export function getMicrophoneAccessErrorMessage(input: MicrophoneAccessErrorInput): string {
  const isPt = input.language === "pt-BR";
  const errorName = input.name || "UnknownError";
  const browserDetail = input.message ? ` (${errorName}: ${input.message})` : ` (${errorName})`;

  if (!input.secureContext) {
    return isPt
      ? "O microfone so funciona em contexto seguro. Abra pelo http://localhost:3001 no teste local, ou por HTTPS em producao."
      : "Microphone access requires a secure context. Open the local test through http://localhost:3001, or use HTTPS in production.";
  }

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return isPt
      ? `A permissao do microfone esta bloqueada. Clique no icone ao lado da URL, libere Microphone/Microfone, recarregue a pagina e tente de novo. No macOS, confira System Settings > Privacy & Security > Microphone.${browserDetail}`
      : `Microphone permission is blocked. Click the site settings icon next to the URL, allow Microphone, reload the page, and try again. On macOS, also check System Settings > Privacy & Security > Microphone.${browserDetail}`;
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return isPt
      ? `Nenhum microfone conectado foi encontrado. Conecte ou selecione um microfone e tente de novo.${browserDetail}`
      : `No connected microphone was found. Connect or select a microphone and try again.${browserDetail}`;
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return isPt
      ? `O microfone parece estar ocupado por outro aplicativo. Feche apps de chamada/gravacao e tente novamente.${browserDetail}`
      : `The microphone appears to be busy in another app. Close calling or recording apps and try again.${browserDetail}`;
  }

  return isPt
    ? `Nao foi possivel acessar o microfone.${browserDetail}`
    : `Could not access the microphone.${browserDetail}`;
}

export function getRealtimeSessionErrorMessage(input: RealtimeSessionErrorInput): string {
  const isPt = input.language === "pt-BR";
  const status = input.status ? `HTTP ${input.status}` : "request failed";
  const detail = input.serverError ? ` Server detail: ${input.serverError}` : "";
  const noRealtimeAccess =
    input.serverError &&
    /OpenAI API key does not have access to Realtime models/i.test(input.serverError);
  const providerRejectedModel =
    input.serverError &&
    (/model_not_found/i.test(input.serverError) ||
      /does not exist or you do not have access/i.test(input.serverError));

  if (noRealtimeAccess) {
    return isPt
      ? `O teste por voz Realtime ainda nao esta disponivel para a chave/projeto OpenAI configurado (${status}). Use o teste escrito enquanto o acesso Realtime e liberado.${detail}`
      : `Realtime voice is not available for the configured OpenAI key/project yet (${status}). Use the written test while Realtime access is enabled.${detail}`;
  }

  if (providerRejectedModel) {
    return isPt
      ? `A OpenAI rejeitou o modelo Realtime configurado (${status}).${detail}`
      : `OpenAI rejected the configured Realtime model (${status}).${detail}`;
  }

  if (input.status === 401 || input.status === 403) {
    return isPt
      ? `A sessao de voz foi bloqueada pela autenticacao do app (${status}). Recarregue a pagina, faca login no Hub novamente e tente de novo.${detail}`
      : `The voice session was blocked by app authentication (${status}). Reload the page, sign in to the Hub again, and try again.${detail}`;
  }

  if (input.status === 503) {
    return isPt
      ? `O teste de voz Realtime nao esta configurado no servidor (${status}).${detail}`
      : `The Realtime voice test is not configured on the server (${status}).${detail}`;
  }

  return isPt
    ? `Nao foi possivel iniciar a sessao de voz Realtime (${status}).${detail}`
    : `Could not start the Realtime voice session (${status}).${detail}`;
}
