// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import { NewSchoolInput } from "@/server/super/school-schema";
import { createSchool } from "@/server/super/schools";
import { createSections, deleteSection, listSections, SectionInput, setSectionActive, splitNames, updateSection } from "./sections";

const run = Date.now().toString(36);
let S: number;
let other: number;
let actor: number;
let planId: number;
const ids: Record<string, number> = {};

const raw = (over: Record<string, string> = {}) => ({ classId: String(ids.six), names: "ক", version: "BANGLA", shift: "MORNING", groupId: "", capacity: "", ...over });
const input = (over: Record<string, string> = {}) => SectionInput.parse(raw(over));
const names = async () => (await listSections(forSchool(S))).map((s) => `${s.classId === ids.six ? "6" : s.classId === ids.nine ? "9" : "?"}/${s.name}/${s.shift}`);

beforeAll(async () => {
  planId = (await db.plan.create({ data: { name: `Sec ${run}`, price: "1", billingCycle: "MONTHLY", maxStudents: 10, features: [] } })).id;
  actor = (await db.user.create({ data: { email: `sec-${run}@x.test` } })).id;
  const make = async (code: string) => {
    const r = await createSchool(
      NewSchoolInput.parse({
        code, nameBn: "সেকশন স্কুল", nameEn: "Section School", eiin: "", board: "", levels: ["SECONDARY"], phone: "", email: "", district: "", upazila: "",
        planId: String(planId), trialDays: "30", adminNameEn: "Admin", adminNameBn: "", adminEmail: `${code}@x.test`, adminPhone: "",
      }),
      actor,
    );
    if (!r.ok) throw new Error("setup");
    return r.schoolId;
  };
  S = await make(`sec-${run}`);
  other = await make(`sec2-${run}`);
  ids.six = (await db.schoolClass.findFirstOrThrow({ where: { schoolId: S, order: 9 } })).id;
  ids.nine = (await db.schoolClass.findFirstOrThrow({ where: { schoolId: S, order: 12 } })).id;
  ids.science = (await db.group.findFirstOrThrow({ where: { schoolId: S, nameEn: "Science" } })).id;
  ids.otherScience = (await db.group.findFirstOrThrow({ where: { schoolId: other, nameEn: "Science" } })).id;
  ids.otherSix = (await db.schoolClass.findFirstOrThrow({ where: { schoolId: other, order: 9 } })).id;
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

describe("form", () => {
  it("splits names and checks values", () => {
    expect(splitNames(" ক, খ ,গ,, ক ")).toEqual(["ক", "খ", "গ"]);
    expect(input({ capacity: "60", groupId: "" })).toMatchObject({ names: ["ক"], capacity: 60, groupId: null });
    const bads: Record<string, string>[] = [{ names: " , " }, { capacity: "0" }, { capacity: "abc" }, { version: "HINDI" }, { shift: "NIGHT" }];
    for (const bad of bads) {
      expect(SectionInput.safeParse(raw(bad)).success).toBe(false);
    }
  });
});

describe("sections", () => {
  it("creates several at once, all or none", async () => {
    const sdb = forSchool(S);
    expect((await createSections(sdb, S, input({ names: "ক, খ, গ" }), actor)).ok).toBe(true);
    expect((await createSections(sdb, S, input({ names: "ক", shift: "DAY" }), actor)).ok).toBe(true); // same name, other shift: fine
    expect(await createSections(sdb, S, input({ names: "ঘ, খ" }), actor)).toEqual({ ok: false, error: "exists:খ", field: "names" });
    expect(await names()).toEqual(["6/ক/MORNING", "6/খ/MORNING", "6/গ/MORNING", "6/ক/DAY"]); // ঘ was not created either
  });

  it("groups only where the class has them, and only this school's", async () => {
    const sdb = forSchool(S);
    expect(await createSections(sdb, S, input({ groupId: String(ids.science) }), actor)).toEqual({ ok: false, error: "noGroupsInClass", field: "groupId" });
    expect((await createSections(sdb, S, input({ classId: String(ids.nine), names: "বিজ্ঞান", groupId: String(ids.science) }), actor)).ok).toBe(true);
    expect(await createSections(sdb, S, input({ classId: String(ids.nine), names: "X", groupId: String(ids.otherScience) }), actor)).toEqual({ ok: false, error: "group", field: "groupId" });
    expect(await createSections(sdb, S, input({ classId: String(ids.otherSix) }), actor)).toEqual({ ok: false, error: "class", field: "classId" });
  });

  it("edits a section but not its class; checks capacity and group against students", async () => {
    const sdb = forSchool(S);
    const kha = (await listSections(sdb)).find((s) => s.name === "খ")!;
    expect((await updateSection(sdb, S, kha.id, input({ names: "খ", version: "ENGLISH", capacity: "40" }), actor)).ok).toBe(true);
    expect(await updateSection(sdb, S, kha.id, input({ classId: String(ids.nine), names: "খ" }), actor)).toEqual({ ok: false, error: "classLocked", field: "classId" });
    const ka = (await listSections(sdb)).find((s) => s.name === "ক" && s.shift === "MORNING")!;
    expect(await updateSection(sdb, S, ka.id, input({ names: "গ" }), actor)).toEqual({ ok: false, error: "exists:গ", field: "names" });

    // Two students in the Science section of Class Nine.
    const sci = (await listSections(sdb)).find((s) => s.name === "বিজ্ঞান")!;
    const session = await db.academicSession.findFirstOrThrow({ where: { schoolId: S, isCurrent: true } });
    for (const roll of [1, 2]) {
      const st = await db.student.create({
        data: { schoolId: S, studentCode: `s-${run}-${roll}`, nameBn: "ক", nameEn: "K", dateOfBirth: new Date("2011-01-01"), gender: "MALE", religion: "ISLAM", admissionDate: new Date("2026-01-01") },
      });
      await db.enrollment.create({ data: { schoolId: S, studentId: st.id, sessionId: session.id, classId: ids.nine, sectionId: sci.id, groupId: ids.science, roll } });
    }
    const nineInput = (over: Record<string, string>) => input({ classId: String(ids.nine), names: "বিজ্ঞান", groupId: String(ids.science), ...over });
    expect(await updateSection(sdb, S, sci.id, nineInput({ capacity: "1" }), actor)).toEqual({ ok: false, error: "capacityBelow:2", field: "capacity" });
    expect(await updateSection(sdb, S, sci.id, nineInput({ groupId: "" }), actor)).toEqual({ ok: false, error: "groupHasStudents", field: "groupId" });
    expect((await updateSection(sdb, S, sci.id, nineInput({ capacity: "2" }), actor)).ok).toBe(true);
    expect((await listSections(sdb)).find((s) => s.id === sci.id)?.students).toBe(2);
  });

  it("switches off only without students; deletes only never-used sections", async () => {
    const sdb = forSchool(S);
    const rows = await listSections(sdb);
    const ga = rows.find((s) => s.name === "গ")!;
    const sci = rows.find((s) => s.name === "বিজ্ঞান")!;
    expect(await setSectionActive(sdb, S, sci.id, false, actor)).toEqual({ ok: false, error: "sectionHasStudents" });
    expect((await setSectionActive(sdb, S, ga.id, false, actor)).ok).toBe(true);
    expect(await deleteSection(sdb, S, sci.id, actor)).toEqual({ ok: false, error: "sectionUsed" });
    expect((await deleteSection(sdb, S, ga.id, actor)).ok).toBe(true);
    expect((await listSections(sdb)).map((s) => s.name)).not.toContain("গ");
  });

  it("another school can't see or change these sections", async () => {
    const id = (await listSections(forSchool(S)))[0].id;
    expect(await listSections(forSchool(other))).toEqual([]);
    expect(await updateSection(forSchool(other), other, id, input({ classId: String(ids.otherSix) }), actor)).toEqual({ ok: false, error: "notFound" });
    expect(await setSectionActive(forSchool(other), other, id, false, actor)).toEqual({ ok: false, error: "notFound" });
    expect(await deleteSection(forSchool(other), other, id, actor)).toEqual({ ok: false, error: "notFound" });
  });
});
