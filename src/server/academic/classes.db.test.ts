// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import { NewSchoolInput } from "@/server/super/school-schema";
import { createSchool } from "@/server/super/schools";
import {
  addLevel,
  ClassInput,
  GroupInput,
  listClasses,
  listGroups,
  missingLevels,
  saveGroup,
  setClassActive,
  setGroupActive,
  updateClass,
} from "./classes";

const run = Date.now().toString(36);
let S: number; // primary + secondary school
let other: number;
let actor: number;
let planId: number;

const make = async (code: string, levels: string[]) => {
  const r = await createSchool(
    NewSchoolInput.parse({
      code, nameBn: "ক্লাস স্কুল", nameEn: "Class School", eiin: "", board: "", levels, phone: "", email: "", district: "", upazila: "",
      planId: String(planId), trialDays: "30", adminNameEn: "Admin", adminNameBn: "", adminEmail: `${code}@x.test`, adminPhone: "",
    }),
    actor,
  );
  if (!r.ok) throw new Error("setup");
  return r.schoolId;
};
const cls = async (nameEn: string, schoolId = S) => (await listClasses(forSchool(schoolId))).find((c) => c.nameEn === nameEn)!;
const input = (over: Record<string, string> = {}) => ClassInput.parse({ nameBn: "নবম", nameEn: "Nine", hasGroups: "on", ...over });

beforeAll(async () => {
  planId = (await db.plan.create({ data: { name: `C ${run}`, price: "1", billingCycle: "MONTHLY", maxStudents: 10, features: [] } })).id;
  actor = (await db.user.create({ data: { email: `cls-${run}@x.test` } })).id;
  S = await make(`cls-${run}`, ["PRIMARY", "SECONDARY"]);
  other = await make(`cls2-${run}`, ["PRIMARY"]);
});

afterAll(async () => {
  for (const schoolId of [S, other]) {
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
  }
  await db.user.delete({ where: { id: actor } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

describe("classes", () => {
  it("renames a class and logs it; names must be unique", async () => {
    const sdb = forSchool(S);
    const nine = await cls("Class Nine");
    expect(await updateClass(sdb, S, nine.id, input({ nameBn: "নবম শ্রেণি (নতুন)", nameEn: "Class Nine" }), actor)).toEqual({ ok: true });
    expect((await cls("Class Nine")).nameBn).toBe("নবম শ্রেণি (নতুন)");
    expect(await updateClass(sdb, S, nine.id, input({ nameBn: "দশম শ্রেণি", nameEn: "X" }), actor)).toEqual({ ok: false, error: "nameTaken" });
    expect(await db.auditLog.count({ where: { schoolId: S, entity: "SchoolClass" } })).toBe(1);
  });

  it("groups only from Class Nine; can't drop groups while sections use them", async () => {
    const sdb = forSchool(S);
    const six = await cls("Class Six");
    expect(await updateClass(sdb, S, six.id, input({ nameBn: "ষষ্ঠ শ্রেণি", nameEn: "Class Six" }), actor)).toEqual({ ok: false, error: "groupsOnlyNineUp" });

    const ten = await cls("Class Ten");
    const science = (await listGroups(sdb)).find((g) => g.nameEn === "Science")!;
    await db.section.create({ data: { schoolId: S, classId: ten.id, groupId: science.id, name: "Science-A" } });
    expect(await updateClass(sdb, S, ten.id, input({ nameBn: "দশম শ্রেণি", nameEn: "Class Ten", hasGroups: "" }), actor)).toEqual({ ok: false, error: "groupedSections" });
  });

  it("switches a class off only when it has no students this session", async () => {
    const sdb = forSchool(S);
    const one = await cls("Class One");
    expect(await setClassActive(sdb, S, one.id, false, actor)).toEqual({ ok: true });
    expect((await cls("Class One")).isActive).toBe(false);
    expect(await setClassActive(sdb, S, one.id, true, actor)).toEqual({ ok: true });

    const seven = await cls("Class Seven");
    const session = await db.academicSession.findFirstOrThrow({ where: { schoolId: S, isCurrent: true } });
    const sec = await db.section.create({ data: { schoolId: S, classId: seven.id, name: "A" } });
    const st = await db.student.create({
      data: { schoolId: S, studentCode: `c-${run}`, nameBn: "ক", nameEn: "K", dateOfBirth: new Date("2014-01-01"), gender: "FEMALE", religion: "ISLAM", admissionDate: new Date("2026-01-01") },
    });
    await db.enrollment.create({ data: { schoolId: S, studentId: st.id, sessionId: session.id, classId: seven.id, sectionId: sec.id, roll: 1 } });
    expect((await cls("Class Seven")).students).toBe(1);
    expect(await setClassActive(sdb, S, seven.id, false, actor)).toEqual({ ok: false, error: "classHasStudents" });
  });

  it("adds a missing level with its classes, groups if needed, and the school level", async () => {
    // The primary-only school has no groups yet; adding higher secondary brings them.
    const sdb = forSchool(other);
    expect(await missingLevels(sdb)).toEqual(["PRE_PRIMARY", "SECONDARY", "HIGHER_SECONDARY"]);
    expect(await listGroups(sdb)).toHaveLength(0);
    expect(await addLevel(sdb, other, "HIGHER_SECONDARY", actor)).toEqual({ ok: true });
    expect((await listClasses(sdb)).map((c) => c.order)).toEqual([4, 5, 6, 7, 8, 14, 15]);
    expect(await listGroups(sdb)).toHaveLength(3);
    expect((await db.school.findUniqueOrThrow({ where: { id: other } })).levels).toEqual(["PRIMARY", "HIGHER_SECONDARY"]);
    expect(await addLevel(sdb, other, "HIGHER_SECONDARY", actor)).toEqual({ ok: false, error: "levelExists" });
  });

  it("can't touch another school's class", async () => {
    const nine = await cls("Class Nine");
    expect(await updateClass(forSchool(other), other, nine.id, input(), actor)).toEqual({ ok: false, error: "notFound" });
    expect(await setClassActive(forSchool(other), other, nine.id, false, actor)).toEqual({ ok: false, error: "notFound" });
  });
});

describe("groups", () => {
  it("adds and renames groups with unique names", async () => {
    const sdb = forSchool(S);
    expect(await saveGroup(sdb, S, null, GroupInput.parse({ nameBn: "কৃষি শিক্ষা", nameEn: "Agriculture" }), actor)).toEqual({ ok: true });
    expect(await saveGroup(sdb, S, null, GroupInput.parse({ nameBn: "বিজ্ঞান", nameEn: "Sci 2" }), actor)).toEqual({ ok: false, error: "nameTaken" });
    const agri = (await listGroups(sdb)).find((g) => g.nameEn === "Agriculture")!;
    expect(await saveGroup(sdb, S, agri.id, GroupInput.parse({ nameBn: "কৃষি", nameEn: "Agriculture" }), actor)).toEqual({ ok: true });
    expect((await listGroups(sdb)).map((g) => g.nameBn)).toEqual(["বিজ্ঞান", "ব্যবসায় শিক্ষা", "মানবিক", "কৃষি"]);
  });

  it("switches off an unused group; refuses one with sections; other school's group isn't found", async () => {
    const sdb = forSchool(S);
    const groups = await listGroups(sdb);
    const business = groups.find((g) => g.nameEn === "Business Studies")!;
    const science = groups.find((g) => g.nameEn === "Science")!;
    expect(await setGroupActive(sdb, S, business.id, false, actor)).toEqual({ ok: true });
    expect(await setGroupActive(sdb, S, science.id, false, actor)).toEqual({ ok: false, error: "groupInUse" }); // Class Ten Science-A
    expect(await setGroupActive(forSchool(other), other, science.id, false, actor)).toEqual({ ok: false, error: "notFound" });
    expect(GroupInput.safeParse({ nameBn: " ", nameEn: "x" }).success).toBe(false);
  });
});
