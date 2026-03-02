/**
 * Date utility functions for installment calculations
 *
 * IMPORTANT: All date-only values (due dates, installment dates) use UTC noon
 * (12:00:00Z) to prevent timezone-related date shifts. This ensures:
 * - toISOString().split('T')[0] always returns the intended date
 * - addMonths calculations using UTC operations produce correct results
 * - No timezone (UTC-12 to UTC+14) can shift the date to a different day
 */

/**
 * Parse YYYY-MM-DD string as UTC noon (12:00:00Z)
 *
 * Background:
 * - new Date('2026-01-30') interprets as UTC midnight (00:00:00Z)
 * - In UTC-3 timezone, this displays as Jan 29, 9:00 PM (wrong day!)
 * - Using local timezone (new Date(year, month, day)) causes addMonths
 *   to produce wrong results when it reads UTC components
 *
 * Solution:
 * - Parse as UTC noon (12:00:00Z) which is safe in ALL timezones
 * - UTC noon can never shift to a different calendar day regardless of timezone
 * - toISOString().split('T')[0] always returns the correct date string
 * - addMonths (which uses UTC operations) reads the correct day
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object at UTC noon for the given date
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // Use UTC noon to prevent any timezone from shifting the calendar day
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/**
 * Adds months to a date respecting calendar months.
 * Handles month-end overflow by clamping to last day of target month.
 *
 * Works in UTC to match parseLocalDate's UTC-based dates.
 *
 * Examples:
 * - Jan 31 + 1 month = Feb 28/29 (not Mar 2/3)
 * - Jan 31 + 2 months = Mar 31 (correct)
 * - Jan 15 + 1 month = Feb 15 (correct)
 *
 * @param date - Base date (should be UTC noon from parseLocalDate)
 * @param months - Number of months to add
 * @returns New date with months added (UTC noon)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());

  // Work in UTC to match parseLocalDate's UTC-based dates
  const originalDay = result.getUTCDate();
  const targetMonth = result.getUTCMonth() + months;
  const targetYear = result.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;

  // Set to target year and month with same day (preserves UTC noon time)
  result.setUTCFullYear(targetYear, normalizedTargetMonth, originalDay);

  // If day changed due to month-end overflow, clamp to last day of target month
  if (result.getUTCDate() !== originalDay) {
    // Set to day 0 of next month = last day of target month
    result.setUTCFullYear(targetYear, normalizedTargetMonth + 1, 0);
  }

  return result;
}

/**
 * Format a Date as YYYY-MM-DD string using UTC components.
 * Use this instead of toISOString().split('T')[0] for clarity
 * and consistency with the UTC-noon convention.
 *
 * @param date - Date object (should be UTC noon from parseLocalDate)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Normalize a date-like value to a date-only UTC noon representation.
 * This avoids timezone shifts when rendering or comparing calendar days.
 */
export function normalizeDateOnly(value: Date | string): Date {
  if (typeof value === "string") {
    const dateOnly = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      return parseLocalDate(dateOnly);
    }
    const parsed = new Date(value);
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        12,
        0,
        0,
        0
      )
    );
  }

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      12,
      0,
      0,
      0
    )
  );
}

/**
 * Difference in calendar days using UTC date parts only.
 */
export function differenceInCalendarDaysUTC(later: Date | string, earlier: Date | string): number {
  const a = normalizeDateOnly(later);
  const b = normalizeDateOnly(earlier);
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((aUtc - bUtc) / (1000 * 60 * 60 * 24));
}
