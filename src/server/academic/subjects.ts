// Subjects of one school (ADMIN). Always called with `sdb`.
import "server-only";
import type { SchoolDb } from "@/server/db/school-db";
import { combinedCode, paperNames, type EditSubjectInput, type NewSubjectInput } from "./subject-schema";

export * from "./subject-schema";

type Result = { ok: true } | { ok: false; error: string; field?: string };

const usage = { classSubjects: true, optionalFor: true, subjectTeachers: true, routinePeriods: true, examSubjects: true } as const;

/** Parents/single subjects in code order, each with its papers right after it. */
export async function listSubjects(sdb: SchoolDb) {
  const rows = await sdb.subject.findMany({
    orderBy: { code: "asc" },
    select: { id: true, nameBn: true, nameEn: true, code: true, isCombined: true, paperOfId: true, religion: true, isActive: true, _count: { select: usage } },
  });
  const flat = rows.map(({ _count, ...s }) => ({
    ...s,
    classes: _count.classSubjects,
    used: Object.values(_count).some((n) => n > 0),
  }));
  const top = flat.filter((s) => s.paperOfId === null);
  return top.flatMap((s) => {
    const papers = flat.filter((p) => p.paperOfId === s.id);
    // A combined subject counts as used when any of its papers is.
    const used = s.used || papers.some((p) => p.used);
    return [{ ...s, used, isPaper: false }, ...papers.map((p) => ({ ...p, used: p.used, isPaper: true }))];
  });
}
export type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

export function getSubject(sdb: SchoolDb, id: number) {
  return sdb.subject.findUnique({
    where: { id },
    select: { id: true, nameBn: true, nameEn: true, code: true, isCombined: true, paperOfId: true, religion: true, isActive: true },
  });
}

async function codesTaken(sdb: SchoolDb, codes: string[], exceptId?: number) {
  const rows = await sdb.subject.findMany({ where: { code: { in: codes }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { code: true } });
  return rows.map((r) => r.code);
}

export async function createSubject(sdb: SchoolDb, schoolId: number, input: NewSubjectInput, actorId: number): Promise<Result> {
  if (input.kind === "SINGLE") {
    if ((await codesTaken(sdb, [input.code])).length) return { ok: false, error: "codeTaken", field: "code" };
    await sdb.$transaction(async (tx) => {
      const s = await tx.subject.create({ data: { schoolId, nameBn: input.nameBn, nameEn: input.nameEn, code: input.code, religion: input.religion } });
      await tx.auditLog.create({ data: { schoolId, userId: actorId, action: "CREATE", entity: "Subject", entityId: String(s.id), after: input } });
    });
    return { ok: true };
  }

  const codes = [input.code1, input.code2];
  const taken = await codesTaken(sdb, [...codes, combinedCode(codes)]);
  if (taken.length) return { ok: false, error: `codeTaken:${taken.join(", ")}`, field: taken.includes(input.code1) ? "code1" : "code2" };

  await sdb.$transaction(async (tx) => {
    const parent = await tx.subject.create({
      data: { schoolId, nameBn: input.nameBn, nameEn: input.nameEn, code: combinedCode(codes), isCombined: true },
    });
    const names = paperNames(input.nameBn, input.nameEn);
    for (const [i, c] of codes.entries()) {
      await tx.subject.create({ data: { schoolId, ...names[i], code: c, paperOfId: parent.id } });
    }
    await tx.auditLog.create({ data: { schoolId, userId: actorId, action: "CREATE", entity: "Subject", entityId: String(parent.id), after: input } });
  });
  return { ok: true };
}

/**
 * Rename / re-code one subject. A combined parent's code isn't typed: it
 * follows its papers ("101+102"). Religion only on single subjects.
 */
export async function updateSubject(sdb: SchoolDb, schoolId: number, id: number, input: EditSubjectInput, actorId: number): Promise<Result> {
  const before = await getSubject(sdb, id);
  if (!before) return { ok: false, error: "notFound" };
  const code = before.isCombined ? before.code : (input.code ?? before.code);
  if (code !== before.code && (await codesTaken(sdb, [code], id)).length) return { ok: false, error: "codeTaken", field: "code" };
  const religion = before.isCombined || before.paperOfId ? null : (input.religion ?? null);

  await sdb.$transaction(async (tx) => {
    await tx.subject.update({ where: { id }, data: { nameBn: input.nameBn, nameEn: input.nameEn, code, religion } });
    // A paper's code changed → its parent's combined code follows.
    if (before.paperOfId && code !== before.code) {
      const papers = await tx.subject.findMany({ where: { paperOfId: before.paperOfId }, orderBy: { id: "asc" }, select: { code: true } });
      await tx.subject.update({ where: { id: before.paperOfId }, data: { code: combinedCode(papers.map((p) => p.code)) } });
    }
    await tx.auditLog.create({
      data: {
        schoolId, userId: actorId, action: "UPDATE", entity: "Subject", entityId: String(id),
        before: { nameBn: before.nameBn, nameEn: before.nameEn, code: before.code, religion: before.religion },
        after: { nameBn: input.nameBn, nameEn: input.nameEn, code, religion },
      },
    });
  });
  return { ok: true };
}

/** The subject and, for a combined subject, its papers. */
const family = (rows: SubjectRow[], id: number) => rows.filter((r) => r.id === id || r.paperOfId === id);

/**
 * Switch off a subject the school no longer teaches (it stays in old results).
 * Not while a class still has it (remove it from the class first, T1.20).
 * A combined subject switches with its papers; a paper alone can't be switched.
 */
export async function setSubjectActive(sdb: SchoolDb, schoolId: number, id: number, active: boolean, actorId: number): Promise<Result> {
  const rows = await listSubjects(sdb);
  const row = rows.find((r) => r.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.isPaper) return { ok: false, error: "paperFollowsParent" };
  const group = family(rows, id);
  if (!active && group.some((r) => r.classes > 0)) return { ok: false, error: "subjectInClasses" };

  await sdb.$transaction([
    sdb.subject.updateMany({ where: { id: { in: group.map((r) => r.id) } }, data: { isActive: active } }),
    sdb.auditLog.create({ data: { schoolId, userId: actorId, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "Subject", entityId: String(id), after: { isActive: active } } }),
  ]);
  return { ok: true };
}

/** Delete a never-used subject (with its papers). A paper alone can't be deleted. */
export async function deleteSubject(sdb: SchoolDb, schoolId: number, id: number, actorId: number): Promise<Result> {
  const rows = await listSubjects(sdb);
  const row = rows.find((r) => r.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.isPaper) return { ok: false, error: "paperFollowsParent" };
  if (row.used) return { ok: false, error: "subjectUsed" };

  const group = family(rows, id);
  await sdb.$transaction([
    sdb.subject.deleteMany({ where: { paperOfId: id } }), // papers first: they point to the parent
    sdb.subject.delete({ where: { id } }),
    sdb.auditLog.create({
      data: { schoolId, userId: actorId, action: "DELETE", entity: "Subject", entityId: String(id), before: { names: group.map((r) => `${r.code} ${r.nameEn}`) } },
    }),
  ]);
  return { ok: true };
}
