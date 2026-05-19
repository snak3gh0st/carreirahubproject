export const DEFAULT_REALTIME_TEST_EMAIL = "realtime.voice.test@clientscarreira.test";
export const DEFAULT_REALTIME_TEST_PASSWORD = "CarreiraRealtime!2026";
export const DEFAULT_REALTIME_TEST_NAME = "Realtime Voice Test Student";

type EnvLike = Record<string, string | undefined>;

export function getRealtimeHubTestCredentials(env: EnvLike = process.env): {
  email: string;
  password: string;
  name: string;
} {
  return {
    email: env.HUB_REALTIME_TEST_EMAIL?.trim().toLowerCase() || DEFAULT_REALTIME_TEST_EMAIL,
    password: env.HUB_REALTIME_TEST_PASSWORD || DEFAULT_REALTIME_TEST_PASSWORD,
    name: env.HUB_REALTIME_TEST_NAME?.trim() || DEFAULT_REALTIME_TEST_NAME,
  };
}

function isLocalHost(host: string): boolean {
  const cleanHost = host.toLowerCase().split(":")[0] ?? "";
  return cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "[::1]";
}

export function isRealtimeTestLoginAllowed(input: {
  host: string | null;
  token: string | null;
  env?: EnvLike;
}): boolean {
  const env = input.env ?? process.env;
  const host = input.host ?? "";

  if (env.NODE_ENV !== "production" && isLocalHost(host)) {
    return true;
  }

  const enabled = env.HUB_REALTIME_TEST_LOGIN_ENABLED === "true";
  const secret = env.HUB_REALTIME_TEST_LOGIN_SECRET;
  return Boolean(enabled && secret && input.token && input.token === secret);
}
