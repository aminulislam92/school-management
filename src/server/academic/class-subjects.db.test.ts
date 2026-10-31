// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import { NewSchoolInput } from "@/server/super/school-schema";
import { createSchool } from "@/server/super/schools";
import { createSubject, NewSubjectInput } from "./subjects";
import { addClassSubject, ClassSubjectInput, copyClassSubjects, listClassSubjects, removeClassSubject, updateClassSubject } from "./class-subjects";

const run = Date.now().toString(36);
let S: number;
let other: number;
let actor: number;
let planId: number;
const id: Record<string, number> = {};

const raw = (over: Record<string, string> = {}) => ({
  classId: String(id.six), subjectId: String(id.math), groupId: "", type: "COMPULSORY",
  writtenFull: "70", writtenPass: "", mcqFull: "30", mcqPass: "", practicalFull: "", practicalPass: "", sortOrder: "", ...over,
});
const input = (over: Record<string, string> = {}) => ClassSubjectInput.parse(raw(over));
const sdb = () => forSchool(S);
const show = async (classId: number) =>
  (await listClassSubjects(sdb(), classId)).map((r) => `${r.subject.code} ${r.type}${r.groupId ? ` g${r.groupId === id.science ? "Sci" : "Hum"}` : ""} ${r.writtenFull}/${r.writtenPass}+${r.mcqFull}/${r.mcqPass}+${r.practicalFull}/${r.practicalPass}`);

beforeAll(async () => {
  planId = (await db.plan.create({ data: { name: `CS ${run}`, price: "1", billingCycle: "MONTHLY", maxStudents: 10, features: [] } })).id;
  actor = (await db.user.create({ data: { email: `cs-${run}@x.test` } })).id;
  const make = async (code: string) => {
    const r = await createSchool(
      NewSchoolInput.parse({
        code, nameBn: "বিষয় স্কুল", nameEn: "CS School", eiin: "", board: "", levels: ["SECONDARY"], phone: "", email: "", district: "", upazila: "",
        planId: String(planId), trialDays: "30", adminNameEn: "Admin", adminNameBn: "", adminEmail: `${code}@x.test`, adminPhone: "",
      }),
      actor,
    );
    if (!r.ok) throw new Error("setup");
    return r.schoolId;
  };
  S = await make(`cs-${run}`);
  other = await make(`cs2-${run}`);
  const cls = async (schoolId: number, order: number) => (await db.schoolClass.findFirstOrThrow({ where: { schoolId, order } })).id;
  id.six = await cls(S, 9);
  id.seven = await cls(S, 10);
  id.nine = await cls(S, 12);
  id.otherSix = await cls(other, 9);
  id.science = (await db.group.findFirstOrThrow({ where: { schoolId: S, nameEn: "Science" } })).id;
  id.humanities = (await db.group.findFirstOrThrow({ where: { schoolId: S, nameEn: "Humanities" } })).id;
  const subj = async (schoolId: number, input: Record<string, string>) => {
    await createSubject(forSchool(schoolId), schoolId, NewSubjectInput.parse(input), actor);
    return (await db.subject.findFirstOrThrow({ where: { schoolId, code: input.code ?? `${input.code1}+${input.code2}` } })).id;
  };
  id.math = await subj(S, { kind: "SINGLE", nameBn: "গণিত", nameEn: "Math", code: "109", religion: "" });
  id.bangla = await subj(S, { kind: "TWO_PAPER", nameBn: "বাংলা", nameEn: "Bangla", code1: "101", code2: "102" });
  id.islam = await subj(S, { kind: "SINGLE", nameBn: "ইসলাম", nameEn: "Islam", code: "111", religion: "ISLAM" });
  id.physics = await subj(S, { kind: "SINGLE", nameBn: "পদার্থ", nameEn: "Physics", code: "136", religion: "" });
  id.higherMath = await subj(S, { kind: "SINGLE", nameBn: "উচ্চতর গণিত", nameEn: "Higher Math", code: "126", religion: "" });
  id.otherMath = await subj(other, { kind: "SINGLE", nameBn: "গণিত", nameEn: "Math", code: "109", religion: "" });
});

afterAll(async () => {
  for (const schoolId of [S, other]) {
    const where = { schoolId };
    await db.classSubject.deleteMany({ where: { class: where } });
    await db.subject.deleteMany({ where: { ...where, paperOfId: { not: null } } });
    await db.subject.deleteMany({ where });
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

describe("adding subjects to a class", () => {
  it("fills 33% pass marks; a two-paper subject adds both papers", async () => {
    expect(await addClassSubject(sdb(), S, input(), actor)).toEqual({ ok: true, count: 1 });
    expect(await addClassSubject(sdb(), S, input({ subjectId: String(id.bangla), writtenFull: "100", mcqFull: "" }), actor)).toEqual({ ok: true, count: 2 });
    expect(await addClassSubject(sdb(), S, input({ subjectId: String(id.islam), type: "RELIGION", writtenFull: "50", writtenPass: "17", mcqFull: "25", practicalFull: "25" }), actor)).toEqual({ ok: true, count: 1 });
    expect(await show(id.six)).toEqual([
      "109 COMPULSORY 70/23+30/10+0/0",
      "101 COMPULSORY 100/33+0/0+0/0",
      "102 COMPULSORY 100/33+0/0+0/0",
      "111 RELIGION 50/17+25/8+25/8",
    ]);
  });

  it("refuses wrong combinations", async () => {
    const bad = async (over: Record<string, string>) => addClassSubject(sdb(), S, input(over), actor);
    expect(await bad({})).toEqual({ ok: false, error: "alreadyInClass", field: "subjectId" });
    expect(await bad({ subjectId: String(id.physics), type: "OPTIONAL" })).toEqual({ ok: false, error: "optionalNineUp", field: "type" });
    expect(await bad({ subjectId: String(id.physics), type: "RELIGION" })).toEqual({ ok: false, error: "notReligionSubject", field: "type" });
    expect(await bad({ subjectId: String(id.islam), classId: String(id.seven) })).toEqual({ ok: false, error: "religionNeedsType", field: "type" });
    expect(await bad({ subjectId: String(id.physics), groupId: String(id.science) })).toEqual({ ok: false, error: "noGroupsInClass", field: "groupId" });
    expect(await bad({ subjectId: String(id.physics), mcqPass: "31" })).toEqual({ ok: false, error: "passAboveFull:mcq", field: "marks" });
    expect(await bad({ subjectId: String(id.physics), writtenFull: "", mcqFull: "" })).toEqual({ ok: false, error: "noMarks", field: "marks" });
    // A paper can't be picked alone, and another school's ids aren't found.
    const paper = await db.subject.findFirstOrThrow({ where: { schoolId: S, code: "101" } });
    expect(await bad({ subjectId: String(paper.id) })).toEqual({ ok: false, error: "subject", field: "subjectId" });
    expect(await bad({ subjectId: String(id.otherMath) })).toEqual({ ok: false, error: "subject", field: "subjectId" });
    expect(await addClassSubject(sdb(), S, input({ classId: String(id.otherSix), subjectId: String(id.physics) }), actor)).toEqual({ ok: false, error: "class", field: "form" });
  });

  it("groups in Class Nine: per group, or for all groups — not both", async () => {
    const nine = (over: Record<string, string>) => addClassSubject(sdb(), S, input({ classId: String(id.nine), ...over }), actor);
    expect((await nine({ subjectId: String(id.physics), groupId: String(id.science), writtenFull: "50", mcqFull: "25", practicalFull: "25" })).ok).toBe(true);
    expect((await nine({ subjectId: String(id.higherMath), groupId: String(id.science), type: "OPTIONAL" })).ok).toBe(true);
    expect((await nine({ subjectId: String(id.higherMath), groupId: String(id.humanities), type: "OPTIONAL" })).ok).toBe(true); // another group: fine
    expect(await nine({ subjectId: String(id.higherMath) })).toEqual({ ok: false, error: "alreadyInClass", field: "subjectId" }); // all groups clashes
    expect((await nine({ subjectId: String(id.math) })).ok).toBe(true);
    expect(await nine({ subjectId: String(id.math), groupId: String(id.science) })).toEqual({ ok: false, error: "alreadyInClass", field: "subjectId" });
    expect(await show(id.nine)).toEqual([
      "136 COMPULSORY gSci 50/17+25/8+25/8",
      "126 OPTIONAL gSci 70/23+30/10+0/0",
      "126 OPTIONAL gHum 70/23+30/10+0/0",
      "109 COMPULSORY 70/23+30/10+0/0",
    ]);
  });
});

describe("editing, removing, copying", () => {
  it("edits marks of one paper; type follows to the other paper", async () => {
    const rows = await listClassSubjects(sdb(), id.six);
    const second = rows.find((r) => r.subject.code === "102")!;
    const r = await updateClassSubject(sdb(), S, second.id, input({ subjectId: String(second.subject.id), writtenFull: "50", writtenPass: "0", mcqFull: "50" }), actor);
    expect(r).toEqual({ ok: true });
    expect((await show(id.six)).filter((x) => /^10[12] /.test(x))).toEqual(["101 COMPULSORY 100/33+0/0+0/0", "102 COMPULSORY 50/0+50/17+0/0"]);
  });

  it("removes both papers together; refuses once an exam uses the subject", async () => {
    const rows = await listClassSubjects(sdb(), id.six);
    const first = rows.find((r) => r.subject.code === "101")!;
    expect(await removeClassSubject(sdb(), S, first.id, actor)).toEqual({ ok: true });
    expect((await show(id.six)).map((x) => x.split(" ")[0])).toEqual(["109", "111"]);

    const session = await db.academicSession.findFirstOrThrow({ where: { schoolId: S, isCurrent: true } });
    const exam = await db.exam.create({ data: { schoolId: S, sessionId: session.id, name: "Half yearly", type: "HALF_YEARLY" } });
    await db.examSubject.create({ data: { examId: exam.id, classId: id.six, subjectId: id.math } });
    const math = (await listClassSubjects(sdb(), id.six)).find((r) => r.subject.code === "109")!;
    expect(await removeClassSubject(sdb(), S, math.id, actor)).toEqual({ ok: false, error: "classSubjectUsed" });
    await db.exam.delete({ where: { id: exam.id } });
  });

  it("copies Class Nine into Class Seven, skipping group and 4th subjects, and what is there", async () => {
    // Class Seven has no groups: only common subjects copy.
    expect(await copyClassSubjects(sdb(), S, id.nine, id.seven, actor)).toEqual({ ok: true, count: 1 });
    expect(await show(id.seven)).toEqual(["109 COMPULSORY 70/23+30/10+0/0"]);
    expect(await copyClassSubjects(sdb(), S, id.nine, id.seven, actor)).toEqual({ ok: false, error: "nothingToCopy" });
    expect(await copyClassSubjects(sdb(), S, id.six, id.six, actor)).toEqual({ ok: false, error: "sameClass" });
    expect(await copyClassSubjects(forSchool(other), other, id.six, id.otherSix, actor)).toEqual({ ok: false, error: "class" });
  });

  it("another school can't edit or remove these rows", async () => {
    const row = (await listClassSubjects(sdb(), id.six))[0];
    expect(await listClassSubjects(forSchool(other), id.six)).toEqual([]);
    expect(await updateClassSubject(forSchool(other), other, row.id, input(), actor)).toEqual({ ok: false, error: "notFound", field: "form" });
    expect(await removeClassSubject(forSchool(other), other, row.id, actor)).toEqual({ ok: false, error: "notFound" });
  });
});
