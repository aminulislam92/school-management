// Business rules about school days (US-2.6). Pure functions on "YYYY-MM-DD" dates.
// Used by the holiday page now and by attendance later (no attendance on an off day).
import { addDays } from "@/lib/dates";

export const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/** "2026-11-06" → "FRI" (the calendar day itself, no time zone involved). */
export function weekdayOf(ymd: string): (typeof WEEKDAY_CODES)[number] {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Every day from `from` to `to`, both included. */
export function daysFrom(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A school day: not a weekly day off (Settings) and not in the holiday list. */
export function isSchoolDay(ymd: string, weeklyHolidays: readonly string[], holidays: ReadonlySet<string>): boolean {
  return !weeklyHolidays.includes(weekdayOf(ymd)) && !holidays.has(ymd);
}

export type HolidayDay = { date: string; title: string };
export type HolidayRange = { title: string; from: string; to: string; days: number };

/** Next-to-each-other days with the same name become one range: Eid 28 Mar – 3 Apr (7 days). */
export function holidayRanges(rows: HolidayDay[]): HolidayRange[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const out: HolidayRange[] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && last.title === r.title && addDays(last.to, 1) === r.date) {
      last.to = r.date;
      last.days += 1;
    } else {
      out.push({ title: r.title, from: r.date, to: r.date, days: 1 });
    }
  }
  return out;
}
