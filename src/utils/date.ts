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
