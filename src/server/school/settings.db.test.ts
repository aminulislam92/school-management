// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/authenticate";
import { hashPassword } from "@/server/auth/password";
import { forSchool } from "@/server/db/school-db";
import { NewSchoolInput } from "@/server/super/school-schema";
import { createSchool } from "@/server/super/schools";
import { getGeneralSettings, parseGeneralSettingsForm, updateGeneralSettings } from "./settings";

const run = Date.now().toString(36);
let schoolId: number;
let actor: number;
let planId: number;

const form = (fields: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) fd.append(k, one);
  return fd;
};
const base = { defaultLocale: "bn", weeklyHolidays: ["FRI"], studentLoginFromOrder: "9", studentCanSeeFees: "on", smsOnAbsent: "on", smsOnPayment: "on", smsOnResult: "on" };

beforeAll(async () => {
  planId = (await db.plan.create({ data: { name: `S ${run}`, price: "1", billingCycle: "MONTHLY", maxStudents: 10, features: [] } })).id;
  const r = await createSchool(
    NewSchoolInput.parse({
      code: `set-${run}`, nameBn: "সেটিং স্কুল", nameEn: "Settings School", eiin: "", board: "", levels: ["PRIMARY", "SECONDARY"],
      phone: "", email: "", district: "", upazila: "", planId: String(planId), trialDays: "30", adminNameEn: "Admin", adminNameBn: "",
      adminEmail: `set-${run}@x.test`, adminPhone: "",
    }),
    (await db.user.create({ data: { email: `set-actor-${run}@x.test` } })).id,
  );
  if (!r.ok) throw new Error("setup");
  schoolId = r.schoolId;
  actor = (await db.user.findFirstOrThrow({ where: { schoolId } })).id;
});

afterAll(async () => {
  const where = { schoolId };
  await db.enrollment.deleteMany({ where });
  await db.section.deleteMany({ where });
  await db.student.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.subscription.deleteMany({ where });
  await db.userRole.deleteMany({ where: { user: where } });
  await db.staff.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.academicSession.deleteMany({ where });
  await db.gradeScaleItem.deleteMany({ where: { gradeScale: where } });
  await db.gradeScale.deleteMany({ where });
  await db.smsTemplate.deleteMany({ where });
  await db.feeType.deleteMany({ where });
  await db.group.deleteMany({ where });
  await db.schoolClass.deleteMany({ where });
  await db.schoolSetting.deleteMany({ where });
  await db.school.delete({ where: { id: schoolId } });
  await db.user.deleteMany({ where: { email: `set-actor-${run}@x.test` } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

describe("parseGeneralSettingsForm", () => {
  it("reads the form", () => {
    const r = parseGeneralSettingsForm(form({ ...base, weeklyHolidays: ["FRI", "SAT", "FRI"], studentCanSeeFees: "", smsOnResult: "" }));
    expect(r.success && r.data).toEqual({
      defaultLocale: "bn",
      weeklyHolidays: ["SAT", "FRI"], // week order, no duplicates
      studentLoginFromOrder: 9,
      studentCanSeeFees: false,
      smsOnAbsent: true,
      smsOnPayment: true,
      smsOnResult: false,
    });
    expect(parseGeneralSettingsForm(form({ ...base, studentLoginFromOrder: "" })).data?.studentLoginFromOrder).toBeNull();
  });

  it("rejects bad values", () => {
    for (const bad of [{ defaultLocale: "fr" }, { weeklyHolidays: ["SAT", "SUN", "MON", "TUE"] }, { weeklyHolidays: ["XYZ"] }, { studentLoginFromOrder: "abc" }]) {
      expect(parseGeneralSettingsForm(form({ ...base, ...bad })).success).toBe(false);
    }
  });
});

describe("updateGeneralSettings", () => {
  it("saves through the school-limited client, logging only changes", async () => {
    const sdb = forSchool(schoolId);
    const input = parseGeneralSettingsForm(form({ ...base, defaultLocale: "en", weeklyHolidays: ["FRI", "SAT"], smsOnAbsent: "" })).data!;
    expect(await updateGeneralSettings(sdb, schoolId, input, actor)).toEqual({ ok: true, changed: 3 });
    expect(await updateGeneralSettings(sdb, schoolId, input, actor)).toEqual({ ok: true, changed: 0 });

    const { setting } = await getGeneralSettings(sdb, schoolId);
    expect([setting.defaultLocale, setting.weeklyHolidays, setting.smsOnAbsent]).toEqual(["en", ["SAT", "FRI"], false]);
    const log = await db.auditLog.findFirstOrThrow({ where: { schoolId, entity: "SchoolSetting" } });
    expect(log.after).toEqual({ defaultLocale: "en", weeklyHolidays: ["SAT", "FRI"], smsOnAbsent: false });
  });

  it("refuses a class this school doesn't have", async () => {
    // Primary + secondary only: no Play (1) or Class Eleven (14).
    const input = parseGeneralSettingsForm(form({ ...base, studentLoginFromOrder: "14" })).data!;
    expect(await updateGeneralSettings(forSchool(schoolId), schoolId, input, actor)).toEqual({ ok: false, errors: { studentLoginFromOrder: "studentLogin" } });
  });
});

describe("student login follows the setting", () => {
  it("lets a Class Seven student in only while the school allows it", async () => {
    const sdb = forSchool(schoolId);
    const classSeven = await db.schoolClass.findFirstOrThrow({ where: { schoolId, order: 10 } });
    const session = await db.academicSession.findFirstOrThrow({ where: { schoolId, isCurrent: true } });
    const section = await db.section.create({ data: { schoolId, classId: classSeven.id, name: "A" } });
    const user = await db.user.create({
      data: { schoolId, username: `S-${run}`, passwordHash: await hashPassword("Student@123"), roles: { create: { role: "STUDENT" } } },
    });
    const student = await db.student.create({
      data: {
        schoolId, userId: user.id, studentCode: `S-${run}`, nameBn: "ছাত্র", nameEn: "Student", dateOfBirth: new Date("2014-01-01"),
        gender: "MALE", religion: "ISLAM", admissionDate: new Date("2026-01-01"),
      },
    });
    await db.enrollment.create({ data: { schoolId, studentId: student.id, sessionId: session.id, classId: classSeven.id, sectionId: section.id, roll: 1 } });
    const login = () => authenticate({ identifier: `S-${run}`, password: "Student@123", schoolId });
    const setFrom = async (order: string) =>
      updateGeneralSettings(sdb, schoolId, parseGeneralSettingsForm(form({ ...base, studentLoginFromOrder: order })).data!, actor);

    await setFrom("9"); // from Class Six
    expect((await login()).ok).toBe(true);
    await setFrom("11"); // from Class Eight
    expect(await login()).toEqual({ ok: false, reason: "studentLoginOff" });
    await setFrom(""); // off
    expect(await login()).toEqual({ ok: false, reason: "studentLoginOff" });
    expect(await authenticate({ identifier: `S-${run}`, password: "wrong", schoolId })).toEqual({ ok: false, reason: "invalid" }); // wrong password still says "invalid"
  });
});
