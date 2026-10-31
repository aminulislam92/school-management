// Academic sessions of one school (ADMIN). Always called with the
// school-limited client `sdb` from getSchoolDb().
//   - one "current" session per type (SCHOOL / COLLEGE) — US-2.2
//   - sessions of the same type may not overlap
//   - a session that already has data (enrollments, exams, invoices...) can't be deleted
import "server-only";
import type { SessionType } from "@prisma/client";
import { dateOnly, ymdOf } from "@/lib/dates";
import type { SchoolDb } from "@/server/db/school-db";
import { overlaps, type SessionInput } from "./session-schema";

export * from "./session-schema";

type Errors = Record<string, string>;
export type SessionResult = { ok: true; id: number } | { ok: false; errors: Errors };

// Everything that hangs off a session. If any count is > 0, the session is in use.
const usage = {
  enrollments: true,
  classTeachers: true,
  subjectTeachers: true,
  routinePeriods: true,
  feeStructures: true,
  invoices: true,
  exams: true,
  resultConfigs: true,
  resultBatches: true,
} as const;

export async function listSessions(sdb: SchoolDb) {
  const rows = await sdb.academicSession.findMany({
    orderBy: [{ type: "asc" }, { startDate: "desc" }],
    select: { id: true, name: true, type: true, startDate: true, endDate: true, isCurrent: true, _count: { select: usage } },
  });
  return rows.map(({ _count, startDate, endDate, ...s }) => ({
    ...s,
    startDate: ymdOf(startDate),
    endDate: ymdOf(endDate),
    students: _count.enrollments,
    inUse: Object.values(_count).some((n) => n > 0),
  }));
}
export type SessionRow = Awaited<ReturnType<typeof listSessions>>[number];

export async function getSession(sdb: SchoolDb, id: number) {
  const s = await sdb.academicSession.findUnique({ where: { id }, select: { id: true, name: true, type: true, startDate: true, endDate: true, isCurrent: true } });
  return s && { ...s, startDate: ymdOf(s.startDate), endDate: ymdOf(s.endDate) };
}

/** Problems shared by create and update: college allowed, name free, no overlap. */
async function check(sdb: SchoolDb, input: SessionInput, levels: string[], exceptId?: number): Promise<Errors | null> {
  if (input.type === "COLLEGE" && !levels.includes("HIGHER_SECONDARY")) return { type: "noCollege" };
  const sameType = (await listSessions(sdb)).filter((s) => s.type === input.type && s.id !== exceptId);
  if (sameType.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) return { name: "nameTaken" };
  const clash = sameType.find((s) => overlaps(s, input));
  if (clash) return { endDate: `overlap:${clash.name}` };
  return null;
}

export async function createSession(sdb: SchoolDb, schoolId: number, input: SessionInput, levels: string[], actorId: number): Promise<SessionResult> {
  const errors = await check(sdb, input, levels);
  if (errors) return { ok: false, errors };

  // The first session of a type becomes current right away.
  const hasCurrent = await sdb.academicSession.count({ where: { type: input.type, isCurrent: true } });
  const id = await sdb.$transaction(async (tx) => {
    const s = await tx.academicSession.create({
      data: { schoolId, type: input.type, name: input.name, startDate: dateOnly(input.startDate), endDate: dateOnly(input.endDate), isCurrent: hasCurrent === 0 },
    });
    await tx.auditLog.create({
      data: { schoolId, userId: actorId, action: "CREATE", entity: "AcademicSession", entityId: String(s.id), after: { ...input, isCurrent: s.isCurrent } },
    });
    return s.id;
  });
  return { ok: true, id };
}

/** Name and dates can change; the type can't (its data would end up under the wrong kind). */
export async function updateSession(
  sdb: SchoolDb,
  schoolId: number,
  id: number,
  input: SessionInput,
  levels: string[],
  actorId: number,
): Promise<SessionResult> {
  const before = await getSession(sdb, id);
  if (!before) return { ok: false, errors: { form: "notFound" } };
  if (before.type !== input.type) return { ok: false, errors: { type: "typeLocked" } };
  const errors = await check(sdb, input, levels, id);
  if (errors) return { ok: false, errors };

  await sdb.$transaction([
    sdb.academicSession.update({ where: { id }, data: { name: input.name, startDate: dateOnly(input.startDate), endDate: dateOnly(input.endDate) } }),
    sdb.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "UPDATE",
        entity: "AcademicSession",
        entityId: String(id),
        before: { name: before.name, startDate: before.startDate, endDate: before.endDate },
        after: { name: input.name, startDate: input.startDate, endDate: input.endDate },
      },
    }),
  ]);
  return { ok: true, id };
}

/** Makes one session current; the previous current one of the same type stops being current. */
export async function setCurrentSession(sdb: SchoolDb, schoolId: number, id: number, actorId: number): Promise<SessionResult> {
  const target = await getSession(sdb, id);
  if (!target) return { ok: false, errors: { form: "notFound" } };
  if (target.isCurrent) return { ok: true, id };

  const previous = await sdb.academicSession.findFirst({ where: { type: target.type, isCurrent: true }, select: { id: true, name: true } });
  await sdb.$transaction([
    sdb.academicSession.updateMany({ where: { type: target.type, isCurrent: true }, data: { isCurrent: false } }),
    sdb.academicSession.update({ where: { id }, data: { isCurrent: true } }),
    sdb.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "SET_CURRENT",
        entity: "AcademicSession",
        entityId: String(id),
        before: { current: previous?.name ?? null },
        after: { current: target.name, type: target.type },
      },
    }),
  ]);
  return { ok: true, id };
}

/** Only an unused, non-current session can be deleted (a mistake right after creating it). */
export async function deleteSession(sdb: SchoolDb, schoolId: number, id: number, actorId: number): Promise<SessionResult> {
  const row = (await listSessions(sdb)).find((s) => s.id === id);
  if (!row) return { ok: false, errors: { form: "notFound" } };
  if (row.isCurrent) return { ok: false, errors: { form: "deleteCurrent" } };
  if (row.inUse) return { ok: false, errors: { form: "deleteInUse" } };

  await sdb.$transaction([
    sdb.academicSession.delete({ where: { id } }),
    sdb.auditLog.create({
      data: { schoolId, userId: actorId, action: "DELETE", entity: "AcademicSession", entityId: String(id), before: { name: row.name, type: row.type, startDate: row.startDate, endDate: row.endDate } },
    }),
  ]);
  return { ok: true, id };
}

/** Suggestion for the "new session" form, per type. */
export async function nextSessionSuggestions(sdb: SchoolDb, today: string) {
  const rows = await listSessions(sdb);
  const lastEnd = (type: SessionType) =>
    rows.filter((r) => r.type === type).reduce<string | null>((max, r) => (max === null || r.endDate > max ? r.endDate : max), null);
  return { lastSchoolEnd: lastEnd("SCHOOL"), lastCollegeEnd: lastEnd("COLLEGE"), year: today.slice(0, 4) };
}
