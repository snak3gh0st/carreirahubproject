export const HUB_ACCESS_RESET_TTL_MS = 72 * 60 * 60 * 1000;

export function getHubAccessResetExpiry(now = new Date()) {
  return new Date(now.getTime() + HUB_ACCESS_RESET_TTL_MS);
}

export function buildHubAccessResetUrl(resetToken: string, baseUrl = process.env.NEXTAUTH_URL) {
  const normalizedBaseUrl = (baseUrl || "https://app.carreirausa.com").replace(/\/$/, "");
  return `${normalizedBaseUrl}/hub/set-password?token=${encodeURIComponent(resetToken)}`;
}
