// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import {
  createSession,
  deleteSession,
  listSessions,
  SessionInput,
  setCurrentSession,
  suggestSession,
  updateSession,
} from "./sessions";

const run = Date.now().toString(36);
let A: number; // has a college section
let B: number; // another school
let actor: number;
const BOTH = ["SECONDARY", "HIGHER_SECONDARY"];

const input = (over: Partial<Record<string, string>> = {}) =>
  SessionInput.parse({ type: "SCHOOL", name: "2026", startDate: "2026-01-01", endDate: "2026-12-31", ...over });
const current = async (schoolId: number) =>
  (await listSessions(forSchool(schoolId))).filter((s) => s.isCurrent).map((s) => `${s.type}:${s.name}`).sort();

beforeAll(async () => {
  A = (await db.school.create({ data: { code: `ses-a-${run}`, nameBn: "A", nameEn: "A", levels: BOTH } })).id;
  B = (await db.school.create({ data: { code: `ses-b-${run}`, nameBn: "B", nameEn: "B", levels: ["PRIMARY"] } })).id;
  actor = (await db.user.create({ data: { schoolId: A, email: `ses-${run}@x.test` } })).id;
});

afterAll(async () => {
  const where = { schoolId: { in: [A, B] } };
  await db.enrollment.deleteMany({ where });
  await db.section.deleteMany({ where });
  await db.schoolClass.deleteMany({ where });
  await db.student.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.academicSession.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.school.deleteMany({ where: { id: { in: [A, B] } } });
  await db.$disconnect();
});

describe("form rules", () => {
  it("checks dates and length", () => {
    expect(SessionInput.safeParse({ type: "SCHOOL", name: "2026", startDate: "2026-12-31", endDate: "2026-01-01" }).success).toBe(false);
    expect(SessionInput.safeParse({ type: "SCHOOL", name: "x", startDate: "2026-01-01", endDate: "2026-12-31" }).success).toBe(false);
    expect(SessionInput.safeParse({ type: "COLLEGE", name: "2026-29", startDate: "2026-07-01", endDate: "2029-06-30" }).success).toBe(false);
    expect(SessionInput.safeParse({ type: "COLLEGE", name: "2026-28", startDate: "2026-07-01", endDate: "2028-06-30" }).success).toBe(true); // 2 years OK
  });

  it("suggests the next session", () => {
    expect(suggestSession("SCHOOL", null, "2026-01-01")).toEqual({ type: "SCHOOL", name: "2026", startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(suggestSession("SCHOOL", "2026-12-31", "x")).toMatchObject({ name: "2027", startDate: "2027-01-01", endDate: "2027-12-31" });
    expect(suggestSession("SCHOOL", "2027-12-20", "x")).toMatchObject({ name: "2028", startDate: "2028-01-01" }); // always a calendar year
    expect(suggestSession("COLLEGE", "2027-06-30", "x")).toMatchObject({ name: "2027-28", startDate: "2027-07-01", endDate: "2028-06-30" });
  });
});

describe("sessions", () => {
  it("the first session of each type becomes current; dates stay the same calendar day", async () => {
    const sdb = forSchool(A);
    expect((await createSession(sdb, A, input(), BOTH, actor)).ok).toBe(true);
    expect((await createSession(sdb, A, input({ name: "2027", startDate: "2027-01-01", endDate: "2027-12-31" }), BOTH, actor)).ok).toBe(true);
    expect((await createSession(sdb, A, input({ type: "COLLEGE", name: "2026-27", startDate: "2026-07-01", endDate: "2027-06-30" }), BOTH, actor)).ok).toBe(true);
    expect(await current(A)).toEqual(["COLLEGE:2026-27", "SCHOOL:2026"]);
    const college = (await listSessions(sdb)).find((s) => s.type === "COLLEGE")!;
    expect([college.startDate, college.endDate]).toEqual(["2026-07-01", "2027-06-30"]);
  });

  it("refuses overlap, duplicate names, and college sessions without a college section", async () => {
    const sdb = forSchool(A);
    expect(await createSession(sdb, A, input({ name: "2026b", startDate: "2026-06-01", endDate: "2026-12-15" }), BOTH, actor)).toEqual({
      ok: false,
      errors: { endDate: "overlap:2026" },
    });
    // Same dates are fine for the other type.
    expect((await createSession(sdb, A, input({ type: "COLLEGE", name: "2027-28", startDate: "2027-07-01", endDate: "2028-06-30" }), BOTH, actor)).ok).toBe(true);
    expect(await createSession(sdb, A, input({ startDate: "2030-01-01", endDate: "2030-12-31" }), BOTH, actor)).toEqual({ ok: false, errors: { name: "nameTaken" } });
    expect(await createSession(forSchool(B), B, input({ type: "COLLEGE", name: "2026-27" }), ["PRIMARY"], actor)).toEqual({ ok: false, errors: { type: "noCollege" } });
  });

  it("makes one session current per type", async () => {
    const sdb = forSchool(A);
    const s2027 = (await listSessions(sdb)).find((s) => s.name === "2027")!;
    expect((await setCurrentSession(sdb, A, s2027.id, actor)).ok).toBe(true);
    expect(await current(A)).toEqual(["COLLEGE:2026-27", "SCHOOL:2027"]); // college untouched
    const log = await db.auditLog.findFirstOrThrow({ where: { schoolId: A, action: "SET_CURRENT" } });
    expect([log.before, log.after]).toEqual([{ current: "2026" }, { current: "2027", type: "SCHOOL" }]);
  });

  it("edits name and dates but not the type; checks overlap except with itself", async () => {
    const sdb = forSchool(A);
    const s2027 = (await listSessions(sdb)).find((s) => s.name === "2027")!;
    expect((await updateSession(sdb, A, s2027.id, input({ name: "2027", startDate: "2027-01-01", endDate: "2027-12-20" }), BOTH, actor)).ok).toBe(true);
    expect(await updateSession(sdb, A, s2027.id, input({ type: "COLLEGE", name: "2027" }), BOTH, actor)).toEqual({ ok: false, errors: { type: "typeLocked" } });
    expect(await updateSession(sdb, A, s2027.id, input({ name: "2027", startDate: "2026-12-01", endDate: "2027-12-20" }), BOTH, actor)).toEqual({
      ok: false,
      errors: { endDate: "overlap:2026" },
    });
  });

  it("can't touch another school's session", async () => {
    const id = (await listSessions(forSchool(A)))[0].id;
    expect(await updateSession(forSchool(B), B, id, input(), ["PRIMARY"], actor)).toEqual({ ok: false, errors: { form: "notFound" } });
    expect(await setCurrentSession(forSchool(B), B, id, actor)).toEqual({ ok: false, errors: { form: "notFound" } });
    expect(await deleteSession(forSchool(B), B, id, actor)).toEqual({ ok: false, errors: { form: "notFound" } });
  });

  it("deletes only an unused, non-current session", async () => {
    const sdb = forSchool(A);
    const rows = await listSessions(sdb);
    const cur = rows.find((s) => s.isCurrent && s.type === "SCHOOL")!;
    const s2026 = rows.find((s) => s.name === "2026")!;
    const s2027_28 = rows.find((s) => s.name === "2027-28")!;
    expect(await deleteSession(sdb, A, cur.id, actor)).toEqual({ ok: false, errors: { form: "deleteCurrent" } });

    // Put one student in the 2026 session: now it is in use.
    const cls = await db.schoolClass.create({ data: { schoolId: A, nameBn: "ষষ্ঠ", nameEn: "Six", level: "SECONDARY", order: 9 } });
    const sec = await db.section.create({ data: { schoolId: A, classId: cls.id, name: "A" } });
    const st = await db.student.create({
      data: { schoolId: A, studentCode: `x-${run}`, nameBn: "ক", nameEn: "K", dateOfBirth: new Date("2014-01-01"), gender: "MALE", religion: "ISLAM", admissionDate: new Date("2026-01-01") },
    });
    await db.enrollment.create({ data: { schoolId: A, studentId: st.id, sessionId: s2026.id, classId: cls.id, sectionId: sec.id, roll: 1 } });
    expect(await deleteSession(sdb, A, s2026.id, actor)).toEqual({ ok: false, errors: { form: "deleteInUse" } });
    expect((await listSessions(sdb)).find((s) => s.id === s2026.id)?.students).toBe(1);

    expect((await deleteSession(sdb, A, s2027_28.id, actor)).ok).toBe(true);
    expect((await listSessions(sdb)).map((s) => s.name)).not.toContain("2027-28");
  });
});
