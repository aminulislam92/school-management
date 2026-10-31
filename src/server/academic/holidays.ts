// Holiday list of one school (ADMIN, US-2.6). Always called with `sdb`.
// One row per day (the table is unique on school + date); the page shows
// next-to-each-other days with the same name as one range.
import "server-only";
import { dateOnly, ymdOf } from "@/lib/dates";
import type { SchoolDb } from "@/server/db/school-db";
import { daysFrom, holidayRanges } from "@/server/services/school-days";
import type { HolidayInput } from "./holiday-schema";

export * from "./holiday-schema";

type Result = { ok: true; days: number } | { ok: false; error: string; field?: string };

export async function listHolidays(sdb: SchoolDb, year: number) {
  const rows = await sdb.holiday.findMany({
    where: { date: { gte: dateOnly(`${year}-01-01`), lte: dateOnly(`${year}-12-31`) } },
    orderBy: { date: "asc" },
    select: { date: true, title: true },
  });
  return holidayRanges(rows.map((r) => ({ date: ymdOf(r.date), title: r.title })));
}

/** Years that have holidays, to offer as tabs. */
export async function holidayYears(sdb: SchoolDb): Promise<number[]> {
  const [first, last] = await Promise.all([
    sdb.holiday.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    sdb.holiday.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  if (!first || !last) return [];
  const out: number[] = [];
  for (let y = first.date.getUTCFullYear(); y <= last.date.getUTCFullYear(); y++) out.push(y);
  return out;
}

/** Adds every day from `from` to `to`. Refused (nothing saved) if any of those days is already a holiday. */
export async function addHoliday(sdb: SchoolDb, schoolId: number, input: HolidayInput, actorId: number): Promise<Result> {
  const days = daysFrom(input.from, input.to);
  const taken = await sdb.holiday.findMany({ where: { date: { in: days.map(dateOnly) } }, select: { date: true } });
  if (taken.length) return { ok: false, error: `taken:${taken.map((t) => ymdOf(t.date)).join(",")}`, field: "from" };

  await sdb.$transaction([
    sdb.holiday.createMany({ data: days.map((d) => ({ schoolId, date: dateOnly(d), title: input.title })) }),
    sdb.auditLog.create({ data: { schoolId, userId: actorId, action: "CREATE", entity: "Holiday", entityId: `${input.from}..${input.to}`, after: input } }),
  ]);
  return { ok: true, days: days.length };
}

/** Removes the days of one range (only rows with that name, so a different holiday inside is kept). */
export async function deleteHolidayRange(sdb: SchoolDb, schoolId: number, from: string, to: string, title: string, actorId: number): Promise<Result> {
  const { count } = await sdb.holiday.deleteMany({ where: { title, date: { gte: dateOnly(from), lte: dateOnly(to) } } });
  if (count === 0) return { ok: false, error: "notFound" };
  await sdb.auditLog.create({ data: { schoolId, userId: actorId, action: "DELETE", entity: "Holiday", entityId: `${from}..${to}`, before: { title, from, to, days: count } } });
  return { ok: true, days: count };
}
