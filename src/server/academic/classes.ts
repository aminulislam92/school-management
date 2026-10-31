// Classes and groups of one school (ADMIN). Always called with `sdb`.
// Classes follow the national ladder (Play=1 … Twelve=15) because promotion
// moves a student from `order` to `order + 1`; a school can rename them,
// switch them on/off and choose groups for 9–12, but not invent new steps.
import "server-only";
import type { Level } from "@prisma/client";
import { db } from "@/lib/db";
import type { SchoolDb } from "@/server/db/school-db";
import { DEFAULT_CLASSES, DEFAULT_GROUPS } from "@/server/school-defaults";
import { canHaveGroups, LEVEL_ORDER, type ClassInput, type GroupInput } from "./class-schema";

export * from "./class-schema";

type Result = { ok: true } | { ok: false; error: string };

/** Students in a class/group in the current session(s): what makes a change risky. */
const currentStudents = { where: { status: "ACTIVE" as const, session: { isCurrent: true } } };

// ── Classes ────────────────────────────────────────────────────────────

export async function listClasses(sdb: SchoolDb) {
  const rows = await sdb.schoolClass.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true, nameBn: true, nameEn: true, level: true, order: true, hasGroups: true, isActive: true,
      _count: { select: { sections: { where: { isActive: true } }, enrollments: currentStudents } },
    },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, sections: _count.sections, students: _count.enrollments }));
}
export type ClassRow = Awaited<ReturnType<typeof listClasses>>[number];

export function getClass(sdb: SchoolDb, id: number) {
  return sdb.schoolClass.findUnique({ where: { id }, select: { id: true, nameBn: true, nameEn: true, level: true, order: true, hasGroups: true, isActive: true } });
}

export async function updateClass(sdb: SchoolDb, schoolId: number, id: number, input: ClassInput, actorId: number): Promise<Result> {
  const before = await getClass(sdb, id);
  if (!before) return { ok: false, error: "notFound" };
  if (input.hasGroups && !canHaveGroups(before.order)) return { ok: false, error: "groupsOnlyNineUp" };
  if (before.hasGroups && !input.hasGroups) {
    // Sections already split by group would be left in a strange state.
    const grouped = await sdb.section.count({ where: { classId: id, isActive: true, groupId: { not: null } } });
    if (grouped > 0) return { ok: false, error: "groupedSections" };
  }
  const nameTaken = await sdb.schoolClass.count({
    where: { id: { not: id }, OR: [{ nameBn: input.nameBn }, { nameEn: input.nameEn }] },
  });
  if (nameTaken) return { ok: false, error: "nameTaken" };

  await sdb.$transaction([
    sdb.schoolClass.update({ where: { id }, data: input }),
    sdb.auditLog.create({
      data: {
        schoolId, userId: actorId, action: "UPDATE", entity: "SchoolClass", entityId: String(id),
        before: { nameBn: before.nameBn, nameEn: before.nameEn, hasGroups: before.hasGroups },
        after: input,
      },
    }),
  ]);
  return { ok: true };
}

/** Switch a class off (not taught here) or on. Off is refused while it has students this session. */
export async function setClassActive(sdb: SchoolDb, schoolId: number, id: number, active: boolean, actorId: number): Promise<Result> {
  const row = (await listClasses(sdb)).find((c) => c.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.isActive === active) return { ok: true };
  if (!active && row.students > 0) return { ok: false, error: "classHasStudents" };

  await sdb.$transaction([
    sdb.schoolClass.update({ where: { id }, data: { isActive: active } }),
    sdb.auditLog.create({
      data: { schoolId, userId: actorId, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "SchoolClass", entityId: String(id), after: { isActive: active } },
    }),
  ]);
  return { ok: true };
}

/** Levels the school doesn't have yet (they can be added with their default classes). */
export async function missingLevels(sdb: SchoolDb): Promise<Level[]> {
  const present = new Set((await sdb.schoolClass.findMany({ select: { level: true } })).map((c) => c.level));
  return LEVEL_ORDER.filter((l) => !present.has(l));
}

/**
 * The school starts teaching a new level (e.g. opens a college section):
 * adds that level's default classes, the default groups if needed, and the
 * level on the school (which allows college sessions).
 */
export async function addLevel(sdb: SchoolDb, schoolId: number, level: Level, actorId: number): Promise<Result> {
  if (!(await missingLevels(sdb)).includes(level)) return { ok: false, error: "levelExists" };
  const classes = DEFAULT_CLASSES.filter((c) => c.level === level);
  const needsGroups = classes.some((c) => c.hasGroups) && (await sdb.group.count()) === 0;
  // `School` is the school itself (global table): plain db, id from the domain.
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { levels: true } });
  const levels = LEVEL_ORDER.filter((l) => l === level || (school.levels as string[]).includes(l));

  await sdb.$transaction(async (tx) => {
    await tx.schoolClass.createMany({ data: classes.map((c) => ({ schoolId, ...c })) });
    if (needsGroups) await tx.group.createMany({ data: DEFAULT_GROUPS.map((g) => ({ schoolId, ...g })) });
    await tx.auditLog.create({
      data: { schoolId, userId: actorId, action: "ADD_LEVEL", entity: "School", entityId: String(schoolId), after: { level, classes: classes.map((c) => c.nameEn) } },
    });
  });
  await db.school.update({ where: { id: schoolId }, data: { levels } });
  return { ok: true };
}

// ── Groups ─────────────────────────────────────────────────────────────

export async function listGroups(sdb: SchoolDb) {
  const rows = await sdb.group.findMany({
    orderBy: { id: "asc" },
    select: { id: true, nameBn: true, nameEn: true, isActive: true, _count: { select: { sections: { where: { isActive: true } }, enrollments: currentStudents } } },
  });
  return rows.map(({ _count, ...g }) => ({ ...g, sections: _count.sections, students: _count.enrollments }));
}
export type GroupRow = Awaited<ReturnType<typeof listGroups>>[number];

export function getGroup(sdb: SchoolDb, id: number) {
  return sdb.group.findUnique({ where: { id }, select: { id: true, nameBn: true, nameEn: true, isActive: true } });
}

/** New group (no id) or rename (id). */
export async function saveGroup(sdb: SchoolDb, schoolId: number, id: number | null, input: GroupInput, actorId: number): Promise<Result> {
  const before = id ? await getGroup(sdb, id) : null;
  if (id && !before) return { ok: false, error: "notFound" };
  const taken = await sdb.group.count({
    where: { ...(id ? { id: { not: id } } : {}), OR: [{ nameBn: input.nameBn }, { nameEn: input.nameEn }] },
  });
  if (taken) return { ok: false, error: "nameTaken" };

  await sdb.$transaction(async (tx) => {
    const g = id ? await tx.group.update({ where: { id }, data: input }) : await tx.group.create({ data: { schoolId, ...input } });
    await tx.auditLog.create({
      data: {
        schoolId, userId: actorId, action: id ? "UPDATE" : "CREATE", entity: "Group", entityId: String(g.id),
        before: before ? { nameBn: before.nameBn, nameEn: before.nameEn } : undefined,
        after: input,
      },
    });
  });
  return { ok: true };
}

export async function setGroupActive(sdb: SchoolDb, schoolId: number, id: number, active: boolean, actorId: number): Promise<Result> {
  const row = (await listGroups(sdb)).find((g) => g.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.isActive === active) return { ok: true };
  if (!active && (row.students > 0 || row.sections > 0)) return { ok: false, error: "groupInUse" };

  await sdb.$transaction([
    sdb.group.update({ where: { id }, data: { isActive: active } }),
    sdb.auditLog.create({
      data: { schoolId, userId: actorId, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "Group", entityId: String(id), after: { isActive: active } },
    }),
  ]);
  return { ok: true };
}
