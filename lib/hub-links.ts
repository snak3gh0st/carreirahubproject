export const HUB_LINKS = {
  operacional: {
    label: "Hub Operacional",
    path: "/ops",
  },
  comercial: {
    label: "Hub Comercial",
    path: "/dashboard",
  },
  financeiro: {
    label: "Hub Financeiro",
    path: "/dashboard/financial",
  },
  executivo: {
    label: "Hub Executivo",
    path: "/dashboard/executive",
  },
  admin: {
    label: "Hub Admin",
    path: "/dashboard",
  },
  cliente: {
    label: "Hub do Cliente",
    path: "/hub/login",
  },
} as const;

export type HubLinkSlug = keyof typeof HUB_LINKS;

export function getHubLink(slug: string) {
  return Object.prototype.hasOwnProperty.call(HUB_LINKS, slug)
    ? HUB_LINKS[slug as HubLinkSlug]
    : null;
}

export function buildSafeCallbackUrl(
  callbackUrl: string | null | undefined,
  fallback = "/dashboard"
) {
  if (!callbackUrl) return fallback;
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return fallback;
  }
  return callbackUrl;
}

export function buildHubRedirectUrl(
  path: string,
  requestUrl: string,
  headers?: Pick<Headers, "get">,
  fallbackBaseUrl?: string | null
) {
  const forwardedHost = headers?.get("x-forwarded-host");
  const host = forwardedHost || headers?.get("host");
  const forwardedProto = headers?.get("x-forwarded-proto");

  if (host && !host.startsWith("0.0.0.0")) {
    const proto = forwardedProto || new URL(requestUrl).protocol.replace(":", "") || "https";
    return new URL(path, `${proto}://${host}`);
  }

  if (fallbackBaseUrl) {
    return new URL(path, fallbackBaseUrl);
  }

  return new URL(path, requestUrl);
}
