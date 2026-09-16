/**
 * IST-aware date utilities.
 * FitBoost targets Indian users (Asia/Kolkata, UTC+5:30).
 * Always use these helpers instead of raw Date().toISOString().split("T")[0]
 * which returns UTC dates — wrong after 18:30 IST.
 */

const IST_TZ = 'Asia/Kolkata';

/**
 * Returns today's date as a YYYY-MM-DD string in IST (Asia/Kolkata).
 * Safe to use after 18:30 IST when UTC has already rolled over to the next day.
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(new Date());
}

/**
 * Returns the YYYY-MM-DD portion of an ISO timestamp string, converted to IST.
 * Use for comparing session startedAt / diary loggedDate values.
 */
export function toISTDateStr(isoString: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(new Date(isoString));
}

/**
 * Returns true if an ISO timestamp string falls on today (in IST).
 */
export function isToday(isoString: string): boolean {
  return toISTDateStr(isoString) === getTodayIST();
}

/**
 * Returns the current calendar month as YYYY-MM in IST (Asia/Kolkata).
 */
export function getCurrentMonthIST(): string {
  return getTodayIST().slice(0, 7);
}

/**
 * Returns the start (inclusive) and end (exclusive) ISO timestamp boundaries
 * for the current calendar month in IST (Asia/Kolkata).
 * e.g., for September 2026: 2026-08-31T18:30:00.000Z to 2026-09-30T18:30:00.000Z.
 */
export function getCurrentMonthRangeIST(): { startIso: string; endIso: string } {
  const currentMonthStr = getCurrentMonthIST(); // "YYYY-MM"
  const [yearStr, monthStr] = currentMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // IST is UTC + 5:30.
  // 1st of month 00:00:00 IST = (month - 1) last day 18:30:00 UTC
  // 1st of next month 00:00:00 IST = month last day 18:30:00 UTC
  const startUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - (5.5 * 3600 * 1000));
  const endUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0) - (5.5 * 3600 * 1000));

  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

/**
 * Checks if an ISO timestamp string belongs to the current calendar month in IST.
 */
export function isCurrentMonthIST(isoString: string): boolean {
  if (!isoString) return false;
  const visitMonth = toISTDateStr(isoString).slice(0, 7);
  return visitMonth === getCurrentMonthIST();
}

/**
 * Formats an ISO timestamp as a user-friendly visit date in IST (e.g., "Mon, 14 Sep 2026").
 */
export function formatVisitDateIST(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats an ISO timestamp as a time string in IST (e.g., "7:30 AM").
 */
export function formatVisitTimeIST(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
