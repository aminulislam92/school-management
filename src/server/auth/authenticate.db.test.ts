// Login rules against your local MySQL: npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate, LOCK_MINUTES, MAX_FAILED_LOGINS } from "./authenticate";
import { hashPassword } from "./password";

const run = Date.now().toString(36);
const PW = "Correct-Horse-9";
let A: number;
let B: number;
let teacherId: number;

async function makeUser(data: {
  schoolId: number | null;
  email?: string;
  phone?: string;
  username?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "GUARDIAN";
  isActive?: boolean;
  password?: string | null;
}) {
  const { role, password = PW, ...rest } = data;
  return db.user.create({
    data: {
      ...rest,
      passwordHash: password ? await hashPassword(password) : null,
      roles: { create: { role } },
    },
  });
}

beforeAll(async () => {
  A = (await db.school.create({ data: { code: `auth-a-${run}`, nameBn: "A", nameEn: "A", levels: [] } })).id;
  B = (await db.school.create({ data: { code: `auth-b-${run}`, nameBn: "B", nameEn: "B", levels: [] } })).id;

  teacherId = (await makeUser({ schoolId: A, email: `teacher-${run}@a.test`, phone: "01811111111", role: "TEACHER" })).id;
  await makeUser({ schoolId: B, email: `teacher-${run}@a.test`, role: "TEACHER", password: "B-school-pass-1" });
  await makeUser({ schoolId: A, username: `${run}-0001`, role: "STUDENT" });
  await makeUser({ schoolId: A, email: `off-${run}@a.test`, role: "TEACHER", isActive: false });
  await makeUser({ schoolId: A, phone: "01922222222", role: "GUARDIAN", password: null });
  await makeUser({ schoolId: null, email: `root-${run}@x.test`, role: "SUPER_ADMIN" });
});

afterAll(async () => {
  await db.userRole.deleteMany({ where: { user: { OR: [{ schoolId: { in: [A, B] } }, { email: `root-${run}@x.test` }] } } });
  await db.user.deleteMany({ where: { OR: [{ schoolId: { in: [A, B] } }, { email: `root-${run}@x.test` }] } });
  await db.school.deleteMany({ where: { id: { in: [A, B] } } });
  await db.$disconnect();
});

describe("authenticate", () => {
  it("logs in with email, phone or Student ID", async () => {
    for (const identifier of [`TEACHER-${run}@a.test`, "01811111111", "+8801811111111"]) {
      const r = await authenticate({ identifier, password: PW, schoolId: A });
      expect(r.ok, identifier).toBe(true);
    }
    const student = await authenticate({ identifier: `${run}-0001`, password: PW, schoolId: A });
    expect(student.ok && student.user.roles).toEqual(["STUDENT"]);
  });

  it("same email in two schools: each school checks its own user", async () => {
    expect((await authenticate({ identifier: `teacher-${run}@a.test`, password: "B-school-pass-1", schoolId: A })).ok).toBe(false);
    expect((await authenticate({ identifier: `teacher-${run}@a.test`, password: "B-school-pass-1", schoolId: B })).ok).toBe(true);
  });

  it("a school user can't log in on the main site, and the super admin only there", async () => {
    expect(await authenticate({ identifier: `teacher-${run}@a.test`, password: PW, schoolId: null })).toEqual({ ok: false, reason: "invalid" });
    expect((await authenticate({ identifier: `root-${run}@x.test`, password: PW, schoolId: null })).ok).toBe(true);
    expect((await authenticate({ identifier: `root-${run}@x.test`, password: PW, schoolId: A })).ok).toBe(false);
  });

  it("unknown user and wrong password give the same answer", async () => {
    expect(await authenticate({ identifier: "nobody@a.test", password: PW, schoolId: A })).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate({ identifier: "01811111111", password: "wrong", schoolId: A })).toEqual({ ok: false, reason: "invalid" });
  });

  it("guardian without a password can't use password login", async () => {
    expect(await authenticate({ identifier: "01922222222", password: "", schoolId: A })).toEqual({ ok: false, reason: "invalid" });
  });

  it("inactive account is only revealed after the right password", async () => {
    expect(await authenticate({ identifier: `off-${run}@a.test`, password: "wrong", schoolId: A })).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate({ identifier: `off-${run}@a.test`, password: PW, schoolId: A })).toEqual({ ok: false, reason: "inactive" });
  });

  it(`locks for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} wrong passwords`, async () => {
    await db.user.update({ where: { id: teacherId }, data: { failedLoginCount: 0, lockedUntil: null } });
    const now = new Date("2026-11-01T10:00:00Z");
    let last;
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      last = await authenticate({ identifier: "01811111111", password: "wrong", schoolId: A }, now);
    }
    expect(last).toMatchObject({ ok: false, reason: "locked" });

    // Even the right password is refused while locked.
    const during = new Date(now.getTime() + 5 * 60_000);
    expect(await authenticate({ identifier: "01811111111", password: PW, schoolId: A }, during)).toMatchObject({ ok: false, reason: "locked" });

    // After the lock ends, the right password works and the counter resets.
    const after = new Date(now.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect((await authenticate({ identifier: "01811111111", password: PW, schoolId: A }, after)).ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({ where: { id: teacherId } });
    expect(u.failedLoginCount).toBe(0);
    expect(u.lockedUntil).toBeNull();
    expect(u.lastLoginAt).toEqual(after);
  });
});
