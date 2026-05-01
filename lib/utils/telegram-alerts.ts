const TELEGRAM_MESSAGE_LIMIT = 4096;
const FIELD_VALUE_LIMIT = 600;
const STACK_LIMIT = 900;

type AlertExtras = Record<string, unknown>;

interface NormalizedError {
  message: string;
  name?: string;
  code?: string;
  status?: string;
  cause?: string;
  details?: string;
  stack?: string;
}

export function buildTelegramErrorMessage(
  context: string,
  error: unknown,
  extra?: AlertExtras
): string {
  const normalized = normalizeError(error);
  const lines = [
    `🔴 <b>ERROR</b> — ${esc(context)}`,
    "",
    `<b>Message:</b> ${esc(normalized.message)}`,
    formatField("Type", normalized.name),
    formatField("Code", normalized.code),
    formatField("Status", normalized.status),
    formatField("Cause", normalized.cause),
    formatField("Details", normalized.details),
    ...formatExtraFields(extra),
    formatField("Host", resolveHost()),
    formatField("Env", resolveEnv()),
    normalized.stack ? `<pre>${esc(truncate(normalized.stack, STACK_LIMIT))}</pre>` : "",
    `<i>${new Date().toISOString()}</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  return trimToTelegramLimit(lines);
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    const err = error as Error & {
      code?: string | number;
      status?: string | number;
      statusCode?: string | number;
      response?: { status?: string | number; data?: unknown };
      cause?: unknown;
      details?: unknown;
      body?: unknown;
      payload?: unknown;
      metadata?: unknown;
    };

    return {
      message: err.message || String(error),
      name: err.name || "Error",
      code: pickFirstString(
        err.code,
        extractFaultCode(err.response?.data),
        err.status ? `HTTP_${err.status}` : undefined,
        err.statusCode ? `HTTP_${err.statusCode}` : undefined,
        err.response?.status ? `HTTP_${err.response.status}` : undefined
      ),
      status: pickFirstString(err.status, err.statusCode, err.response?.status),
      cause: describeCause(err.cause),
      details: stringifyFieldValue(
        err.details ?? err.response?.data ?? err.body ?? err.payload ?? err.metadata,
        FIELD_VALUE_LIMIT
      ),
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }

  return {
    message: stringifyFieldValue(error, FIELD_VALUE_LIMIT) || String(error),
  };
}

function formatExtraFields(extra?: AlertExtras): string[] {
  if (!extra) return [];

  return Object.entries(extra)
    .map(([key, value]) => formatField(key, stringifyFieldValue(value, FIELD_VALUE_LIMIT)))
    .filter(Boolean) as string[];
}

function formatField(label: string, value: string | undefined): string {
  if (!value) return "";
  return `<b>${esc(label)}:</b> ${esc(value)}`;
}

function stringifyFieldValue(value: unknown, limit: number): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") return truncate(value, limit);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return truncate(String(value), limit);
  }
  if (value instanceof Error) {
    return truncate(`${value.name}: ${value.message}`, limit);
  }

  try {
    return truncate(
      JSON.stringify(
        value,
        (_key, nested) => {
          if (nested instanceof Error) {
            return {
              name: nested.name,
              message: nested.message,
            };
          }
          return nested;
        }
      ),
      limit
    );
  } catch {
    return truncate(String(value), limit);
  }
}

function describeCause(cause: unknown): string | undefined {
  if (!cause) return undefined;

  const chain: string[] = [];
  let current: unknown = cause;
  let depth = 0;

  while (current && depth < 3) {
    if (current instanceof Error) {
      chain.push(`${current.name}: ${current.message}`);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      chain.push(String(current));
      break;
    }
    depth += 1;
  }

  return truncate(chain.join(" -> "), FIELD_VALUE_LIMIT);
}

function extractFaultCode(responseData: unknown): string | undefined {
  if (!responseData || typeof responseData !== "object") return undefined;

  const data = responseData as Record<string, any>;

  if (typeof data.code === "string") return data.code;
  if (typeof data.errorCode === "string") return data.errorCode;
  if (typeof data.fault?.type === "string") return data.fault.type;
  if (typeof data.Fault?.type === "string") return data.Fault.type;

  const firstError = Array.isArray(data.Fault?.Error) ? data.Fault.Error[0] : undefined;
  if (typeof firstError?.code === "string") return firstError.code;

  return undefined;
}

function pickFirstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return undefined;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function trimToTelegramLimit(text: string): string {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_MESSAGE_LIMIT - 4)}...`;
}

function resolveHost(): string | undefined {
  return process.env.VERCEL_URL || process.env.HOSTNAME || undefined;
}

function resolveEnv(): string | undefined {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || undefined;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
