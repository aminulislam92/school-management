// General settings of one school (school ADMIN). Always called with the
// school-limited client `sdb` from getSchoolDb().
import "server-only";
import type { SchoolDb } from "@/server/db/school-db";
import type { GeneralSettingsInput, WeekDay } from "./settings-schema";

export * from "./settings-schema";

export async function getGeneralSettings(sdb: SchoolDb, schoolId: number) {
  const [setting, classes] = await Promise.all([
    sdb.schoolSetting.findUniqueOrThrow({
      where: { schoolId },
      select: {
        defaultLocale: true,
        weeklyHolidays: true,
        studentLoginFromOrder: true,
        studentCanSeeFees: true,
        smsOnAbsent: true,
        smsOnPayment: true,
        smsOnResult: true,
      },
    }),
    sdb.schoolClass.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { order: true, nameBn: true, nameEn: true } }),
  ]);
  return { setting: { ...setting, weeklyHolidays: setting.weeklyHolidays as WeekDay[] }, classes };
}

export type SaveSettingsResult = { ok: true; changed: number } | { ok: false; errors: Record<string, string> };

export async function updateGeneralSettings(
  sdb: SchoolDb,
  schoolId: number,
  input: GeneralSettingsInput,
  actorId: number,
): Promise<SaveSettingsResult> {
  const { setting: before, classes } = await getGeneralSettings(sdb, schoolId);

  // "From class X" must be one of this school's classes.
  if (input.studentLoginFromOrder !== null && !classes.some((c) => c.order === input.studentLoginFromOrder)) {
    return { ok: false, errors: { studentLoginFromOrder: "studentLogin" } };
  }

  const keys = Object.keys(input) as (keyof GeneralSettingsInput)[];
  const same = (k: keyof GeneralSettingsInput) => JSON.stringify(before[k]) === JSON.stringify(input[k]);
  const changed = keys.filter((k) => !same(k));
  if (changed.length === 0) return { ok: true, changed: 0 };

  await sdb.$transaction([
    sdb.schoolSetting.update({ where: { schoolId }, data: input }),
    sdb.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "UPDATE",
        entity: "SchoolSetting",
        entityId: String(schoolId),
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, input[k]])),
      },
    }),
  ]);
  return { ok: true, changed: changed.length };
}
