// Sections of one school (ADMIN). Always called with `sdb`.
// Foreign ids from the form (classId, groupId) are loaded through `sdb`
// first, so another school's class or group simply isn't found (CLAUDE.md).
import "server-only";
import type { SchoolDb } from "@/server/db/school-db";
import type { SectionInput } from "./section-schema";

export * from "./section-schema";

type Result = { ok: true; ids: number[] } | { ok: false; error: string; field?: string };

const used = { enrollments: true, classTeachers: true, subjectTeachers: true, routinePeriods: true, notices: true } as const;

export async function listSections(sdb: SchoolDb) {
  const rows = await sdb.section.findMany({
    orderBy: [{ class: { order: "asc" } }, { shift: "asc" }, { version: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, version: true, shift: true, capacity: true, isActive: true, classId: true,
      group: { select: { nameBn: true, nameEn: true } },
      _count: { select: { ...used, enrollments: { where: { status: "ACTIVE", session: { isCurrent: true } } } } },
    },
  });
  // "Ever used" needs every enrollment, not just this session's.
  const everUsed = new Set(
    (
      await sdb.section.findMany({
        where: { OR: [{ enrollments: { some: {} } }, { classTeachers: { some: {} } }, { subjectTeachers: { some: {} } }, { routinePeriods: { some: {} } }, { notices: { some: {} } }] },
        select: { id: true },
      })
    ).map((s) => s.id),
  );
  return rows.map(({ _count, ...s }) => ({ ...s, students: _count.enrollments, everUsed: everUsed.has(s.id) }));
}
export type SectionRow = Awaited<ReturnType<typeof listSections>>[number];

export function getSection(sdb: SchoolDb, id: number) {
  return sdb.section.findUnique({
    where: { id },
    select: { id: true, classId: true, name: true, version: true, shift: true, groupId: true, capacity: true, isActive: true, class: { select: { nameBn: true, nameEn: true, hasGroups: true } } },
  });
}

/** Class and group must be this school's, switched on, and the group only where the class has groups. */
async function checkClassAndGroup(sdb: SchoolDb, input: SectionInput): Promise<{ error: string; field: string } | null> {
  const cls = await sdb.schoolClass.findUnique({ where: { id: input.classId }, select: { isActive: true, hasGroups: true } });
  if (!cls || !cls.isActive) return { error: "class", field: "classId" };
  if (input.groupId !== null) {
    if (!cls.hasGroups) return { error: "noGroupsInClass", field: "groupId" };
    const group = await sdb.group.findUnique({ where: { id: input.groupId }, select: { isActive: true } });
    if (!group || !group.isActive) return { error: "group", field: "groupId" };
  }
  return null;
}

/** Creates one section per name ("ক, খ, গ" → three), all or none. */
export async function createSections(sdb: SchoolDb, schoolId: number, input: SectionInput, actorId: number): Promise<Result> {
  const bad = await checkClassAndGroup(sdb, input);
  if (bad) return { ok: false, ...bad };

  const existing = await sdb.section.findMany({
    where: { classId: input.classId, version: input.version, shift: input.shift, name: { in: input.names } },
    select: { name: true },
  });
  if (existing.length) return { ok: false, error: `exists:${existing.map((e) => e.name).join(", ")}`, field: "names" };

  const ids = await sdb.$transaction(async (tx) => {
    const out: number[] = [];
    for (const name of input.names) {
      const s = await tx.section.create({
        data: { schoolId, classId: input.classId, name, version: input.version, shift: input.shift, groupId: input.groupId, capacity: input.capacity },
      });
      out.push(s.id);
    }
    await tx.auditLog.create({
      data: { schoolId, userId: actorId, action: "CREATE", entity: "Section", entityId: out.join(","), after: { ...input } },
    });
    return out;
  });
  return { ok: true, ids };
}

/** Name, version, shift, group and capacity can change; the class can't. */
export async function updateSection(sdb: SchoolDb, schoolId: number, id: number, input: SectionInput, actorId: number): Promise<Result> {
  const before = await getSection(sdb, id);
  if (!before) return { ok: false, error: "notFound" };
  if (before.classId !== input.classId) return { ok: false, error: "classLocked", field: "classId" };
  if (input.names.length !== 1) return { ok: false, error: "oneName", field: "names" };
  const name = input.names[0];

  const bad = await checkClassAndGroup(sdb, input);
  if (bad) return { ok: false, ...bad };

  const row = (await listSections(sdb)).find((s) => s.id === id)!;
  if (row.students > 0 && before.groupId !== input.groupId) return { ok: false, error: "groupHasStudents", field: "groupId" };
  if (input.capacity !== null && input.capacity < row.students) return { ok: false, error: `capacityBelow:${row.students}`, field: "capacity" };

  const clash = await sdb.section.count({ where: { id: { not: id }, classId: input.classId, name, version: input.version, shift: input.shift } });
  if (clash) return { ok: false, error: `exists:${name}`, field: "names" };

  const data = { name, version: input.version, shift: input.shift, groupId: input.groupId, capacity: input.capacity };
  await sdb.$transaction([
    sdb.section.update({ where: { id }, data }),
    sdb.auditLog.create({
      data: {
        schoolId, userId: actorId, action: "UPDATE", entity: "Section", entityId: String(id),
        before: { name: before.name, version: before.version, shift: before.shift, groupId: before.groupId, capacity: before.capacity },
        after: data,
      },
    }),
  ]);
  return { ok: true, ids: [id] };
}

export async function setSectionActive(sdb: SchoolDb, schoolId: number, id: number, active: boolean, actorId: number): Promise<Result> {
  const row = (await listSections(sdb)).find((s) => s.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.isActive === active) return { ok: true, ids: [id] };
  if (!active && row.students > 0) return { ok: false, error: "sectionHasStudents" };
  if (active) {
    // Its class must still be on.
    const cls = await sdb.schoolClass.findUnique({ where: { id: row.classId }, select: { isActive: true } });
    if (!cls?.isActive) return { ok: false, error: "class" };
  }
  await sdb.$transaction([
    sdb.section.update({ where: { id }, data: { isActive: active } }),
    sdb.auditLog.create({ data: { schoolId, userId: actorId, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "Section", entityId: String(id), after: { isActive: active } } }),
  ]);
  return { ok: true, ids: [id] };
}

/** Only a section that was never used (a typo right after creating it) can be deleted. */
export async function deleteSection(sdb: SchoolDb, schoolId: number, id: number, actorId: number): Promise<Result> {
  const row = (await listSections(sdb)).find((s) => s.id === id);
  if (!row) return { ok: false, error: "notFound" };
  if (row.everUsed) return { ok: false, error: "sectionUsed" };
  await sdb.$transaction([
    sdb.section.delete({ where: { id } }),
    sdb.auditLog.create({ data: { schoolId, userId: actorId, action: "DELETE", entity: "Section", entityId: String(id), before: { name: row.name, classId: row.classId, version: row.version, shift: row.shift } } }),
  ]);
  return { ok: true, ids: [id] };
}
