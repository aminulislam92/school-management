// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "./authenticate";
import { changePassword } from "./change-password";
import { hashPassword } from "./password";

const run = Date.now().toString(36);
const OLD = "Old-pass-2026";
const NEW = "New-pass-2026";
let schoolId: number;
let userId: number;
const email = `pw-${run}@a.test`;

beforeAll(async () => {
  schoolId = (await db.school.create({ data: { code: `pw-${run}`, nameBn: "P", nameEn: "P", levels: [] } })).id;
  userId = (
    await db.user.create({
      data: {
        schoolId,
        email,
        passwordHash: await hashPassword(OLD),
        mustChangePassword: true,
        roles: { create: { role: "TEACHER" } },
      },
    })
  ).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { schoolId } });
  await db.userRole.deleteMany({ where: { user: { schoolId } } });
  await db.user.deleteMany({ where: { schoolId } });
  await db.school.delete({ where: { id: schoolId } });
  await db.$disconnect();
});

describe("changePassword", () => {
  it("refuses a wrong current password", async () => {
    const r = await changePassword({ userId, schoolId, current: "nope", next: NEW, confirm: NEW });
    expect(r).toEqual({ ok: false, problem: "wrongCurrent" });
  });

  it("refuses a weak or repeated password", async () => {
    expect(await changePassword({ userId, schoolId, current: OLD, next: "short1", confirm: "short1" })).toEqual({ ok: false, problem: "tooShort" });
    expect(await changePassword({ userId, schoolId, current: OLD, next: OLD, confirm: OLD })).toEqual({ ok: false, problem: "sameAsOld" });
  });

  it("can't change a user of another school", async () => {
    const r = await changePassword({ userId, schoolId: schoolId + 999999, current: OLD, next: NEW, confirm: NEW });
    expect(r).toEqual({ ok: false, problem: "noUser" });
  });

  it("changes the password, clears the flag, bumps the session version and logs it", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const r = await changePassword({ userId, schoolId, current: OLD, next: NEW, confirm: NEW });
    expect(r).toEqual({ ok: true, sessionVersion: before.sessionVersion + 1 });

    const after = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.mustChangePassword).toBe(false);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);

    expect((await authenticate({ identifier: email, password: OLD, schoolId })).ok).toBe(false);
    const login = await authenticate({ identifier: email, password: NEW, schoolId });
    expect(login.ok && login.user.sessionVersion).toBe(after.sessionVersion);

    const log = await db.auditLog.findFirst({ where: { schoolId, action: "PASSWORD_CHANGE" } });
    expect(log?.entityId).toBe(String(userId));
  });
});
