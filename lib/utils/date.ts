/**
 * Date utility functions for installment calculations
 */

/**
 * Parse YYYY-MM-DD string in LOCAL timezone (not UTC)
 * Fixes timezone bug where '2026-01-30' becomes Jan 29 in UTC-3
 * 
 * Background:
 * - new Date('2026-01-30') interprets as UTC midnight
 * - In UTC-3 timezone, this displays as Jan 29, 9:00 PM
 * - This causes dates to be off by 1 day in user's view
 * 
 * Solution:
 * - Parse components manually and construct Date in local timezone
 * - Ensures '2026-01-30' displays as Jan 30 in ALL timezones
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adds months to a date respecting calendar months.
 * Handles month-end overflow by clamping to last day of target month.
 * 
 * Works in UTC to avoid timezone issues with date strings (e.g., "2024-01-31").
 * 
 * Examples:
 * - Jan 31 + 1 month = Feb 28/29 (not Mar 2/3)
 * - Jan 31 + 2 months = Mar 31 (correct)
 * - Jan 15 + 1 month = Feb 15 (correct)
 * 
 * @param date - Base date
 * @param months - Number of months to add
 * @returns New date with months added
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  
  // Work in UTC to avoid timezone issues
  const originalDay = result.getUTCDate();
  const targetMonth = result.getUTCMonth() + months;
  const targetYear = result.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;
  
  // Set to target year and month with same day
  result.setUTCFullYear(targetYear, normalizedTargetMonth, originalDay);
  
  // If day changed due to month-end overflow, clamp to last day of target month
  if (result.getUTCDate() !== originalDay) {
    // Set to day 0 of next month = last day of target month
    result.setUTCFullYear(targetYear, normalizedTargetMonth + 1, 0);
  }
  
  return result;
}
