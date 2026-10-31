// Rules for the academic session form. No database access, so the browser
// form can import it too.
//   SCHOOL  — Play to Class 10, usually January–December, named "2027".
//   COLLEGE — Class 11–12, dates set by the school, named like "2026-27".
import type { SessionType } from "@prisma/client";
import { z } from "zod";
import { addDays, addMonths, isYmd, periodEnd } from "@/lib/dates";

export const SESSION_TYPES = ["SCHOOL", "COLLEGE"] as const satisfies readonly SessionType[];

const ymd = z.string().trim().refine(isYmd, { message: "date" });

export const SessionInput = z
  .object({
    type: z.enum(SESSION_TYPES, { message: "type" }),
    name: z.string().trim().min(2, { message: "name" }).max(20, { message: "name" }),
    startDate: ymd,
    endDate: ymd,
  })
  // "YYYY-MM-DD" text sorts like the dates themselves.
  .refine((v) => v.endDate > v.startDate, { message: "endBeforeStart", path: ["endDate"] })
  .refine((v) => !isYmd(v.startDate) || v.endDate <= addMonths(v.startDate, 24), { message: "tooLong", path: ["endDate"] });

export type SessionInput = z.infer<typeof SessionInput>;

export function parseSessionForm(formData: FormData) {
  return SessionInput.safeParse({
    type: String(formData.get("type") ?? ""),
    name: String(formData.get("name") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
  });
}

/**
 * A sensible next session of this type (the school can change everything).
 *   SCHOOL:  always a calendar year, the year after the last one ends
 *            (none yet → `firstStart`'s year)           → "2027", 2027-01-01 – 2027-12-31
 *   COLLEGE: starts the day after the last one ends (none yet → `firstStart`),
 *            one year long                               → "2027-28", 2027-07-01 – 2028-06-30
 */
export function suggestSession(type: SessionType, lastEnd: string | null, firstStart: string) {
  if (type === "SCHOOL") {
    const year = lastEnd ? String(Number(lastEnd.slice(0, 4)) + 1) : firstStart.slice(0, 4);
    return { type, name: year, startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  const startDate = lastEnd ? addDays(lastEnd, 1) : firstStart;
  const endDate = periodEnd(startDate, "YEARLY");
  const y1 = startDate.slice(0, 4);
  const y2 = endDate.slice(0, 4);
  return { type, name: y1 === y2 ? y1 : `${y1}-${y2.slice(2)}`, startDate, endDate };
}

/** Two date ranges (inclusive) share at least one day. */
export const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) =>
  a.startDate <= b.endDate && b.startDate <= a.endDate;
