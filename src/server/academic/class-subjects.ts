// Which subject is taught in which class (and group), its type and marks split (ADMIN, US-2.4).
// Always called with `sdb`. Rules:
//   - A two-paper subject is added as its papers (marks are entered per paper);
//     the papers always share their group and type.
//   - In a class with groups, a subject is for all groups OR for chosen groups, not both.
//   - 4th subject (OPTIONAL) only from Class Nine; RELIGION type ⇔ the subject has a religion.
import "server-only";
import type { SubjectType } from "@prisma/client";
import type { SchoolDb } from "@/server/db/school-db";
import { checkSplit, withPass } from "@/server/services/marks-split";
import { canHaveGroups } from "./class-schema";
import type { ClassSubjectInput } from "./class-subject-schema";

export * from "./class-subject-schema";

type Result = { ok: true; count?: number } | { ok: false; error: string; field?: string };

export async function listClassSubjects(sdb: SchoolDb, classId: number) {
  const rows = await sdb.classSubject.findMany({
    where: { classId },
    orderBy: [{ sortOrder: "asc" }, { subject: { code: "asc" } }],
    select: {
      id: true, groupId: true, type: true, sortOrder: true,
      writtenFull: true, writtenPass: true, mcqFull: true, mcqPass: true, practicalFull: true, practicalPass: true,
      subject: { select: { id: true, code: true, nameBn: true, nameEn: true, paperOfId: true, religion: true, isActive: true } },
      group: { select: { nameBn: true, nameEn: true } },
    },
  });
  return rows;
}
export type ClassSubjectRow = Awaited<ReturnType<typeof listClassSubjects>>[number];

export function getClassSubject(sdb: SchoolDb, id: number) {
  return sdb.classSubject.findUnique({
    where: { id },
    select: {
      id: true, classId: true, groupId: true, type: true, sortOrder: true,
      writtenFull: true, writtenPass: true, mcqFull: true, mcqPass: true, practicalFull: true, practicalPass: true,
      subject: { select: { id: true, code: true, nameBn: true, nameEn: true, paperOfId: true, religion: true } },
      class: { select: { nameBn: true, nameEn: true, order: true, hasGroups: true } },
    },
  });
}

/** Subjects that can be picked: single subjects and two-paper parents (not papers, not switched off). */
export async function pickableSubjects(sdb: SchoolDb) {
  return sdb.subject.findMany({
    where: { isActive: true, paperOfId: null },
    orderBy: { code: "asc" },
    select: { id: true, code: true, nameBn: true, nameEn: true, isCombined: true, religion: true },
  });
}

/** The rows a picked subject becomes: itself, or its two papers. */
async function rowsFor(sdb: SchoolDb, subjectId: number) {
  const s = await sdb.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, isActive: true, isCombined: true, paperOfId: true, religion: true, papers: { orderBy: { id: "asc" }, select: { id: true } } },
  });
  if (!s || !s.isActive || s.paperOfId !== null) return null;
  return { religion: s.religion, ids: s.isCombined ? s.papers.map((p) => p.id) : [s.id] };
}

/** Class + group + type rules shared by add, edit and copy. */
async function checkPlace(
  sdb: SchoolDb,
  classId: number,
  groupId: number | null,
  type: SubjectType,
  religion: string | null,
): Promise<{ error: string; field: string } | null> {
  const cls = await sdb.schoolClass.findUnique({ where: { id: classId }, select: { isActive: true, hasGroups: true, order: true } });
  if (!cls || !cls.isActive) return { error: "class", field: "form" };
  if (groupId !== null) {
    if (!cls.hasGroups) return { error: "noGroupsInClass", field: "groupId" };
    const g = await sdb.group.findUnique({ where: { id: groupId }, select: { isActive: true } });
    if (!g?.isActive) return { error: "group", field: "groupId" };
  }
  if (type === "OPTIONAL" && !canHaveGroups(cls.order)) return { error: "optionalNineUp", field: "type" };
  if (type === "RELIGION" && !religion) return { error: "notReligionSubject", field: "type" };
  if (type !== "RELIGION" && religion) return { error: "religionNeedsType", field: "type" };
  return null;
}

/** Is any of these subjects already in the class in a way that clashes with `groupId`? */
async function clash(sdb: SchoolDb, classId: number, subjectIds: number[], groupId: number | null, exceptIds: number[] = []) {
  const existing = await sdb.classSubject.findMany({
    where: { classId, subjectId: { in: subjectIds }, id: { notIn: exceptIds } },
    select: { groupId: true },
  });
  // "All groups" clashes with anything; a group clashes with "all groups" or the same group.
  return existing.some((e) => groupId === null || e.groupId === null || e.groupId === groupId);
}

export async function addClassSubject(sdb: SchoolDb, schoolId: number, input: ClassSubjectInput, actorId: number): Promise<Result> {
  const picked = await rowsFor(sdb, input.subjectId);
  if (!picked) return { ok: false, error: "subject", field: "subjectId" };
  const bad = await checkPlace(sdb, input.classId, input.groupId, input.type, picked.religion);
  if (bad) return { ok: false, ...bad };

  const split = withPass(input, input);
  const wrong = checkSplit(split);
  if (wrong) return { ok: false, error: wrong.part ? `${wrong.error}:${wrong.part}` : wrong.error, field: "marks" };
  if (await clash(sdb, input.classId, picked.ids, input.groupId)) return { ok: false, error: "alreadyInClass", field: "subjectId" };

  const next = input.sortOrder ?? ((await sdb.classSubject.aggregate({ where: { classId: input.classId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;
  await sdb.$transaction(async (tx) => {
    for (const [i, subjectId] of picked.ids.entries()) {
      await tx.classSubject.create({ data: { classId: input.classId, subjectId, groupId: input.groupId, type: input.type, sortOrder: next + i, ...split } });
    }
    await tx.auditLog.create({
      data: { schoolId, userId: actorId, action: "CREATE", entity: "ClassSubject", entityId: `${input.classId}:${picked.ids.join(",")}`, after: { ...input, ...split } },
    });
  });
  return { ok: true, count: picked.ids.length };
}

/** Change type, group, marks and order of one row. Type and group follow to the sibling paper. */
export async function updateClassSubject(sdb: SchoolDb, schoolId: number, id: number, input: ClassSubjectInput, actorId: number): Promise<Result> {
  const before = await getClassSubject(sdb, id);
  if (!before) return { ok: false, error: "notFound", field: "form" };
  const bad = await checkPlace(sdb, before.classId, input.groupId, input.type, before.subject.religion);
  if (bad) return { ok: false, ...bad };
  const split = withPass(input, input);
  const wrong = checkSplit(split);
  if (wrong) return { ok: false, error: wrong.part ? `${wrong.error}:${wrong.part}` : wrong.error, field: "marks" };

  // The other paper of the same two-paper subject, in this class and group.
  const siblings = before.subject.paperOfId
    ? await sdb.classSubject.findMany({
        where: { classId: before.classId, groupId: before.groupId, id: { not: id }, subject: { paperOfId: before.subject.paperOfId } },
        select: { id: true, subjectId: true },
      })
    : [];
  const ids = [id, ...siblings.map((s) => s.id)];
  if (input.groupId !== before.groupId && (await clash(sdb, before.classId, [before.subject.id, ...siblings.map((s) => s.subjectId)], input.groupId, ids))) {
    return { ok: false, error: "alreadyInClass", field: "groupId" };
  }

  await sdb.$transaction([
    sdb.classSubject.update({ where: { id }, data: { ...split, sortOrder: input.sortOrder ?? before.sortOrder } }),
    sdb.classSubject.updateMany({ where: { id: { in: ids } }, data: { type: input.type, groupId: input.groupId } }),
    sdb.auditLog.create({
      data: {
        schoolId, userId: actorId, action: "UPDATE", entity: "ClassSubject", entityId: String(id),
        before: { type: before.type, groupId: before.groupId, writtenFull: before.writtenFull, writtenPass: before.writtenPass, mcqFull: before.mcqFull, mcqPass: before.mcqPass, practicalFull: before.practicalFull, practicalPass: before.practicalPass },
        after: { type: input.type, groupId: input.groupId, ...split },
      },
    }),
  ]);
  return { ok: true };
}

/** Remove a subject (with its sibling paper) from a class — not once exams or 4th-subject choices use it. */
export async function removeClassSubject(sdb: SchoolDb, schoolId: number, id: number, actorId: number): Promise<Result> {
  const row = await getClassSubject(sdb, id);
  if (!row) return { ok: false, error: "notFound" };
  const family = row.subject.paperOfId
    ? await sdb.classSubject.findMany({ where: { classId: row.classId, groupId: row.groupId, subject: { paperOfId: row.subject.paperOfId } }, select: { id: true, subjectId: true } })
    : [{ id, subjectId: row.subject.id }];
  const subjectIds = family.map((f) => f.subjectId);

  const [exams, chosen] = await Promise.all([
    sdb.examSubject.count({ where: { classId: row.classId, subjectId: { in: subjectIds } } }),
    sdb.enrollment.count({ where: { classId: row.classId, optionalSubjectId: { in: subjectIds } } }),
  ]);
  if (exams > 0 || chosen > 0) return { ok: false, error: "classSubjectUsed" };

  await sdb.$transaction([
    sdb.classSubject.deleteMany({ where: { id: { in: family.map((f) => f.id) } } }),
    sdb.auditLog.create({ data: { schoolId, userId: actorId, action: "DELETE", entity: "ClassSubject", entityId: `${row.classId}:${subjectIds.join(",")}`, before: { type: row.type, groupId: row.groupId } } }),
  ]);
  return { ok: true };
}

/**
 * Copy another class's subjects (type, group, marks) into this class. Subjects already
 * here are skipped; group subjects are skipped if this class has no groups; 4th subjects
 * are skipped below Class Nine.
 */
export async function copyClassSubjects(sdb: SchoolDb, schoolId: number, fromClassId: number, toClassId: number, actorId: number): Promise<Result> {
  if (fromClassId === toClassId) return { ok: false, error: "sameClass" };
  const [from, to] = await Promise.all([
    sdb.schoolClass.findUnique({ where: { id: fromClassId }, select: { id: true } }),
    sdb.schoolClass.findUnique({ where: { id: toClassId }, select: { isActive: true, hasGroups: true, order: true } }),
  ]);
  if (!from || !to?.isActive) return { ok: false, error: "class" };

  const source = await listClassSubjects(sdb, fromClassId);
  const here = await listClassSubjects(sdb, toClassId);
  const hereSubjects = new Set(here.map((h) => h.subject.id));
  let order = Math.max(0, ...here.map((h) => h.sortOrder));
  const copy = source.filter(
    (s) => s.subject.isActive && !hereSubjects.has(s.subject.id) && (s.groupId === null || to.hasGroups) && (s.type !== "OPTIONAL" || canHaveGroups(to.order)),
  );
  if (copy.length === 0) return { ok: false, error: "nothingToCopy" };

  await sdb.$transaction(async (tx) => {
    for (const s of copy) {
      const { writtenFull, writtenPass, mcqFull, mcqPass, practicalFull, practicalPass } = s;
      await tx.classSubject.create({
        data: { classId: toClassId, subjectId: s.subject.id, groupId: s.groupId, type: s.type, sortOrder: ++order, writtenFull, writtenPass, mcqFull, mcqPass, practicalFull, practicalPass },
      });
    }
    await tx.auditLog.create({
      data: { schoolId, userId: actorId, action: "COPY", entity: "ClassSubject", entityId: `${fromClassId}->${toClassId}`, after: { subjects: copy.map((c) => c.subject.code) } },
    });
  });
  return { ok: true, count: copy.length };
}
