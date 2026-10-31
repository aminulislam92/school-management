// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/authenticate";
import { NewSchoolInput } from "./school-schema";
import { createSchool, generateTempPassword } from "./schools";

const run = Date.now().toString(36);
let actor: number;
let planId: number;
let inactivePlanId: number;
const schoolIds: number[] = [];

// What the form sends (all text), and the cleaned version.
const raw = (over: Partial<Record<string, unknown>> = {}) => ({
    code: `new-${run}`,
    nameBn: "নতুন উচ্চ বিদ্যালয়",
    nameEn: "Notun High School",
    eiin: "",
    board: "Dhaka",
    levels: ["PRIMARY", "SECONDARY"],
    phone: "",
    email: "",
    district: "",
    upazila: "",
    planId,
    trialDays: "30",
    adminNameEn: "Rahima Begum",
    adminNameBn: "রহিমা বেগম",
    adminEmail: `head-${run}@notun.test`,
    adminPhone: "",
    ...over,
  });
const input = (over: Partial<Record<string, unknown>> = {}) => NewSchoolInput.parse(raw(over));

beforeAll(async () => {
  actor = (await db.user.create({ data: { email: `school-actor-${run}@x.test` } })).id;
  const base = { price: "1000", billingCycle: "MONTHLY" as const, maxStudents: 100, features: [] };
  planId = (await db.plan.create({ data: { ...base, name: `T ${run}` } })).id;
  inactivePlanId = (await db.plan.create({ data: { ...base, name: `Off ${run}`, isActive: false } })).id;
});

afterAll(async () => {
  for (const schoolId of schoolIds) {
    const where = { schoolId };
    await db.auditLog.deleteMany({ where });
    await db.userRole.deleteMany({ where: { user: where } });
    await db.staff.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.subscription.deleteMany({ where });
    await db.academicSession.deleteMany({ where });
    await db.gradeScaleItem.deleteMany({ where: { gradeScale: where } });
    await db.gradeScale.deleteMany({ where });
    await db.smsTemplate.deleteMany({ where });
    await db.feeType.deleteMany({ where });
    await db.group.deleteMany({ where });
    await db.schoolClass.deleteMany({ where });
    await db.schoolSetting.deleteMany({ where });
    await db.school.delete({ where: { id: schoolId } });
  }
  await db.plan.deleteMany({ where: { id: { in: [planId, inactivePlanId] } } });
  await db.user.delete({ where: { id: actor } });
  await db.$disconnect();
});

describe("generateTempPassword", () => {
  it("is 10 readable characters with letters and digits", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^[a-zA-Z2-9]{10}$/);
      expect(pw).not.toMatch(/[01OIl]/);
      expect(pw).toMatch(/\d/);
    }
  });
});

describe("createSchool", () => {
  it("creates the school with everything it needs", async () => {
    const r = await createSchool(input(), actor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    schoolIds.push(r.schoolId);
    const schoolId = r.schoolId;

    const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, include: { setting: true } });
    expect(school.code).toBe(`new-${run}`);
    expect(school.setting?.studentLoginFromOrder).toBe(9);

    // Primary (Class 1–5) + Secondary (6–10) = 10 classes, no Play/KG, no 11–12.
    const classes = await db.schoolClass.findMany({ where: { schoolId }, orderBy: { order: "asc" } });
    expect(classes.map((c) => c.nameEn)).toEqual([
      "Class One", "Class Two", "Class Three", "Class Four", "Class Five",
      "Class Six", "Class Seven", "Class Eight", "Class Nine", "Class Ten",
    ]);
    expect(await db.group.count({ where: { schoolId } })).toBe(3);
    expect(await db.feeType.count({ where: { schoolId } })).toBe(4);
    expect(await db.smsTemplate.count({ where: { schoolId } })).toBe(5);
    expect(await db.gradeScaleItem.count({ where: { gradeScale: { schoolId } } })).toBe(7);
    expect(await db.academicSession.count({ where: { schoolId, isCurrent: true } })).toBe(1);

    const sub = await db.subscription.findFirstOrThrow({ where: { schoolId } });
    expect(sub.status).toBe("TRIAL");
    expect(Math.round((sub.endsAt.getTime() - sub.startsAt.getTime()) / 86_400_000)).toBe(30);

    // The admin can log in on THIS school with the temporary password, and must change it.
    const login = await authenticate({ identifier: r.adminLogin, password: r.tempPassword, schoolId });
    expect(login.ok && login.user.roles).toEqual(["ADMIN"]);
    expect(login.ok && login.user.mustChangePassword).toBe(true);
    expect(await db.staff.count({ where: { schoolId, nameBn: "রহিমা বেগম" } })).toBe(1);

    expect(await db.auditLog.count({ where: { schoolId, entity: "School", action: "CREATE" } })).toBe(1);
  });

  it("a primary-only school gets no groups and no student login", async () => {
    const r = await createSchool(input({ code: `prim-${run}`, levels: ["PRE_PRIMARY", "PRIMARY"] }), actor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    schoolIds.push(r.schoolId);
    expect(await db.schoolClass.count({ where: { schoolId: r.schoolId } })).toBe(8);
    expect(await db.group.count({ where: { schoolId: r.schoolId } })).toBe(0);
    const setting = await db.schoolSetting.findUniqueOrThrow({ where: { schoolId: r.schoolId } });
    expect(setting.studentLoginFromOrder).toBeNull();
  });

  it("refuses a code that is already used", async () => {
    expect(await createSchool(input(), actor)).toEqual({ ok: false, errors: { code: "codeTaken" } });
  });

  it("refuses a switched-off plan", async () => {
    expect(await createSchool(input({ code: `off-${run}`, planId: inactivePlanId }), actor)).toEqual({
      ok: false,
      errors: { planId: "plan" },
    });
    expect(await db.school.count({ where: { code: `off-${run}` } })).toBe(0);
  });
});

describe("NewSchoolInput", () => {
  it("cleans and checks the form", () => {
    const ok = NewSchoolInput.safeParse({
      ...raw(),
      code: "  Ideal-School ",
      phone: "+880 1712-345678",
      adminEmail: "Head@Ideal.TEST",
      eiin: "",
    });
    expect(ok.success && [ok.data.code, ok.data.phone, ok.data.adminEmail, ok.data.eiin]).toEqual([
      "ideal-school",
      "01712345678",
      "head@ideal.test",
      undefined,
    ]);
  });

  it.each([
    [{ code: "www" }, "code"],
    [{ code: "a_b" }, "code"],
    [{ levels: [] }, "levels"],
    [{ eiin: "12ab" }, "eiin"],
    [{ phone: "12345" }, "phone"],
    [{ adminEmail: "", adminPhone: "" }, "adminEmail"],
    [{ trialDays: "120" }, "trialDays"],
  ])("rejects %o", (change, field) => {
    const r = NewSchoolInput.safeParse(raw(change));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(field);
  });
});
