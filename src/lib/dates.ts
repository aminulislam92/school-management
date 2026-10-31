// Calendar dates for Bangladesh (Asia/Dhaka, UTC+6, no daylight saving).
// Forms send "YYYY-MM-DD"; the database stores exact moments (DateTime).
// No database or server-only code here, so forms can use it too.

export const DHAKA_OFFSET = "+06:00";
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-02-30" → false. Only real calendar dates pass. */
export function isYmd(s: string): boolean {
  const m = YMD.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** The first moment of that day in Dhaka. */
export const dhakaDayStart = (ymd: string) => new Date(`${ymd}T00:00:00.000${DHAKA_OFFSET}`);

/** The last moment of that day in Dhaka (so "ends on 30 Nov" includes the whole day). */
export const dhakaDayEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999${DHAKA_OFFSET}`);

/** The Dhaka calendar date of a moment, as "YYYY-MM-DD". */
export function toDhakaYmd(date: Date): string {
  return new Date(date.getTime() + 6 * 60 * 60_000).toISOString().slice(0, 10);
}

/** "2026-01-31" + 1 day → "2026-02-01" (negative days go back). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Same day `months` later; a missing day becomes the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/**
 * Last day of one billing period that starts on `startYmd`.
 *   MONTHLY: 2026-11-01 → 2026-11-30
 *   YEARLY:  2026-11-01 → 2027-10-31
 */
export function periodEnd(startYmd: string, cycle: "MONTHLY" | "YEARLY"): string {
  return addDays(addMonths(startYmd, cycle === "MONTHLY" ? 1 : 12), -1);
}
