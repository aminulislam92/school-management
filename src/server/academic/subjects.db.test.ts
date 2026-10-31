// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import {
  createSubject,
  deleteSubject,
  EditSubjectInput,
  listSubjects,
  NewSubjectInput,
  setSubjectActive,
  updateSubject,
} from "./subjects";

const run = Date.now().toString(36);
let S: number;
let other: number;
let actor: number;

const single = (over: Record<string, string> = {}) =>
  NewSubjectInput.parse({ kind: "SINGLE", nameBn: "গণিত", nameEn: "Mathematics", code: "109", religion: "", ...over });
const twoPaper = (over: Record<string, string> = {}) =>
  NewSubjectInput.parse({ kind: "TWO_PAPER", nameBn: "বাংলা", nameEn: "Bangla", code1: "101", code2: "102", ...over });
const edit = (over: Record<string, string>) => EditSubjectInput.parse({ nameBn: "x", nameEn: "x", ...over });
const rows = () => listSubjects(forSchool(S));
const byCode = async (code: string) => (await rows()).find((r) => r.code === code)!;

beforeAll(async () => {
  S = (await db.school.create({ data: { code: `sub-a-${run}`, nameBn: "A", nameEn: "A", levels: ["SECONDARY"] } })).id;
  other = (await db.school.create({ data: { code: `sub-b-${run}`, nameBn: "B", nameEn: "B", levels: ["SECONDARY"] } })).id;
  actor = (await db.user.create({ data: { schoolId: S, email: `sub-${run}@x.test` } })).id;
});

afterAll(async () => {
  const where = { schoolId: { in: [S, other] } };
  await db.classSubject.deleteMany({ where: { class: where } });
  await db.schoolClass.deleteMany({ where });
  await db.subject.deleteMany({ where: { ...where, paperOfId: { not: null } } });
  await db.subject.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.school.deleteMany({ where: { id: { in: [S, other] } } });
  await db.$disconnect();
});

describe("form", () => {
  it("cleans codes and checks two-paper codes differ", () => {
    expect(single({ code: " ict-1 " })).toMatchObject({ code: "ICT-1", religion: null });
    expect(single({ religion: "ISLAM" }).kind === "SINGLE" && single({ religion: "ISLAM" })).toMatchObject({ religion: "ISLAM" });
    expect(NewSubjectInput.safeParse({ kind: "TWO_PAPER", nameBn: "ক", nameEn: "K", code1: "101", code2: "101" }).success).toBe(false);
    expect(NewSubjectInput.safeParse({ kind: "SINGLE", nameBn: "ক", nameEn: "K", code: "1 0 1", religion: "" }).success).toBe(false);
    expect(NewSubjectInput.safeParse({ kind: "SINGLE", nameBn: "ক", nameEn: "K", code: "101", religion: "JEDI" }).success).toBe(false);
  });
});

describe("subjects", () => {
  it("creates single and two-paper subjects", async () => {
    const sdb = forSchool(S);
    expect(await createSubject(sdb, S, single(), actor)).toEqual({ ok: true });
    expect(await createSubject(sdb, S, single({ nameBn: "ইসলাম ও নৈতিক শিক্ষা", nameEn: "Islam and Moral Education", code: "111", religion: "ISLAM" }), actor)).toEqual({ ok: true });
    expect(await createSubject(sdb, S, twoPaper(), actor)).toEqual({ ok: true });
    expect((await rows()).map((r) => `${r.isPaper ? "  " : ""}${r.code} ${r.nameBn}${r.isCombined ? " [২ পত্র]" : ""}`)).toEqual([
      "101+102 বাংলা [২ পত্র]",
      "  101 বাংলা প্রথম পত্র",
      "  102 বাংলা দ্বিতীয় পত্র",
      "109 গণিত",
      "111 ইসলাম ও নৈতিক শিক্ষা",
    ]);
    expect((await byCode("102")).nameEn).toBe("Bangla 2nd Paper");
  });

  it("refuses codes already used", async () => {
    const sdb = forSchool(S);
    expect(await createSubject(sdb, S, single({ code: "101" }), actor)).toEqual({ ok: false, error: "codeTaken", field: "code" });
    expect(await createSubject(sdb, S, twoPaper({ code1: "107", code2: "109" }), actor)).toEqual({ ok: false, error: "codeTaken:109", field: "code2" });
    expect((await rows()).some((r) => r.code === "107")).toBe(false); // nothing half-made
    // Another school may use the same codes.
    expect(await createSubject(forSchool(other), other, single(), actor)).toEqual({ ok: true });
  });

  it("a paper's new code updates the parent's code; religion only on single subjects", async () => {
    const sdb = forSchool(S);
    const second = await byCode("102");
    expect(await updateSubject(sdb, S, second.id, edit({ nameBn: "বাংলা দ্বিতীয় পত্র", nameEn: "Bangla 2nd Paper", code: "103", religion: "ISLAM" }), actor)).toEqual({ ok: true });
    expect((await byCode("101+103")).isCombined).toBe(true);
    expect((await byCode("103")).religion).toBeNull();
    const parent = await byCode("101+103");
    expect(await updateSubject(sdb, S, parent.id, edit({ nameBn: "বাংলা", nameEn: "Bangla Language", code: "999" }), actor)).toEqual({ ok: true });
    expect((await byCode("101+103")).nameEn).toBe("Bangla Language"); // code ignored for the parent
    expect(await updateSubject(sdb, S, second.id, edit({ code: "109" }), actor)).toEqual({ ok: false, error: "codeTaken", field: "code" });
  });

  it("switching off: whole family together, not while a class has it; papers can't be switched alone", async () => {
    const sdb = forSchool(S);
    const parent = await byCode("101+103");
    const first = await byCode("101");
    expect(await setSubjectActive(sdb, S, first.id, false, actor)).toEqual({ ok: false, error: "paperFollowsParent" });
    expect(await setSubjectActive(sdb, S, parent.id, false, actor)).toEqual({ ok: true });
    expect((await rows()).filter((r) => r.id === parent.id || r.paperOfId === parent.id).map((r) => r.isActive)).toEqual([false, false, false]);
    await setSubjectActive(sdb, S, parent.id, true, actor);

    // Maths is taught in Class Six.
    const cls = await db.schoolClass.create({ data: { schoolId: S, nameBn: "ষষ্ঠ", nameEn: "Six", level: "SECONDARY", order: 9 } });
    const maths = await byCode("109");
    await db.classSubject.create({ data: { classId: cls.id, subjectId: maths.id } });
    expect(await setSubjectActive(sdb, S, maths.id, false, actor)).toEqual({ ok: false, error: "subjectInClasses" });
    expect(await deleteSubject(sdb, S, maths.id, actor)).toEqual({ ok: false, error: "subjectUsed" });
  });

  it("deletes an unused subject with its papers; other schools can't touch it", async () => {
    const sdb = forSchool(S);
    const parent = await byCode("101+103");
    expect(await deleteSubject(forSchool(other), other, parent.id, actor)).toEqual({ ok: false, error: "notFound" });
    expect(await updateSubject(forSchool(other), other, parent.id, edit({}), actor)).toEqual({ ok: false, error: "notFound" });
    expect(await deleteSubject(sdb, S, parent.id, actor)).toEqual({ ok: true });
    expect((await rows()).map((r) => r.code)).toEqual(["109", "111"]);
  });
});
