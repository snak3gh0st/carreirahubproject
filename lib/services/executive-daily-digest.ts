export const DEFAULT_EXECUTIVE_DAILY_DIGEST_EMAIL = "thais@carreirausa.com";

export function getExecutiveDailyDigestEmail(
  testEmail?: string | null,
  configuredEmail = process.env.EXECUTIVE_DAILY_DIGEST_EMAIL,
): string {
  const rawEmail =
    testEmail?.trim() ||
    configuredEmail?.trim() ||
    DEFAULT_EXECUTIVE_DAILY_DIGEST_EMAIL;
  return rawEmail.toLowerCase();
}

export function parseCfoRecommendations(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if (typeof item.title === "string") return item.title;
          if (typeof item.text === "string") return item.text;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item && item.trim()))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function isCfoInsightStale(
  generatedAt: Date | string | null | undefined,
  now = new Date(),
  maxAgeHours = 36,
): boolean {
  if (!generatedAt) return true;
  const generatedDate = typeof generatedAt === "string" ? new Date(generatedAt) : generatedAt;
  if (Number.isNaN(generatedDate.getTime())) return true;
  return now.getTime() - generatedDate.getTime() > maxAgeHours * 60 * 60 * 1000;
}
