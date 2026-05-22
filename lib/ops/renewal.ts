const DAY_MS = 86_400_000;

export const DEFAULT_MENTORSHIP_RENEWAL_DAYS = 185;

export function calculateMentorshipRenewalDate(
  startDate: Date,
  pauseExtensionDays = 0,
  baseDays = DEFAULT_MENTORSHIP_RENEWAL_DAYS
): Date {
  const safePauseDays = Number.isFinite(pauseExtensionDays)
    ? Math.max(0, Math.round(pauseExtensionDays))
    : 0;

  return new Date(startDate.getTime() + (baseDays + safePauseDays) * DAY_MS);
}

export function shouldRecalculateRenewalDateOnProfilePatch(options: {
  requestedRenewalDate: Date | null;
  existingRenewalDate: Date | null;
  requestedPauseExtensionDays: number;
  existingPauseExtensionDays: number;
}): boolean {
  if (!options.requestedRenewalDate) return true;
  if (options.requestedPauseExtensionDays === options.existingPauseExtensionDays) return false;
  if (!options.existingRenewalDate) return false;

  return options.requestedRenewalDate.getTime() === options.existingRenewalDate.getTime();
}
