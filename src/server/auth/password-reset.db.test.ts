// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "./authenticate";
import { hashPassword } from "./password";
import {
  RESET_CODE_MINUTES,
  RESET_MAX_ATTEMPTS,
  RESET_MAX_PER_HOUR,
  requestPasswordReset,
  resetPassword,
} from "./password-reset";

const run = Date.now().toString(36);
const OLD = "Old-pass-2026";
const NEW = "Fresh-pass-2026";
let A: number;
let B: number;
let userId: number;
const email = `reset-${run}@a.test`;

// Captures codes instead of printing them.
let sent: { userId: number; code: string }[] = [];
const deliver = async (to: { userId: number }, code: string) => {
  sent.push({ userId: to.userId, code });
};
const lastCode = () => sent.at(-1)?.code ?? "";

async function clearResets() {
  await db.passwordReset.deleteMany({ where: { userId } });
  sent = [];
}

beforeAll(async () => {
  A = (await db.school.create({ data: { code: `rs-a-${run}`, nameBn: "A", nameEn: "A", levels: [] } })).id;
  B = (await db.school.create({ data: { code: `rs-b-${run}`, nameBn: "B", nameEn: "B", levels: [] } })).id;
  userId = (
    await db.user.create({
      data: {
        schoolId: A,
        email,
        phone: "01733333333",
        passwordHash: await hashPassword(OLD),
        mustChangePassword: true,
        roles: { create: { role: "ACCOUNTANT" } },
      },
    })
  ).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await db.passwordReset.deleteMany({ where: { user: { schoolId: { in: [A, B] } } } });
  await db.userRole.deleteMany({ where: { user: { schoolId: { in: [A, B] } } } });
  await db.user.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await db.school.deleteMany({ where: { id: { in: [A, B] } } });
  await db.$disconnect();
});

describe("requestPasswordReset", () => {
  it("sends a 6-digit code and stores only its hash", async () => {
    await clearResets();
    await requestPasswordReset({ identifier: "01733333333", schoolId: A }, { deliver });
    expect(lastCode()).toMatch(/^\d{6}$/);
    const row = await db.passwordReset.findFirstOrThrow({ where: { userId } });
    expect(row.codeHash).not.toContain(lastCode());
    expect(row.codeHash).toHaveLength(64);
  });

  it("does nothing (and says nothing) for unknown users or another school", async () => {
    await clearResets();
    await requestPasswordReset({ identifier: "nobody@a.test", schoolId: A }, { deliver });
    await requestPasswordReset({ identifier: email, schoolId: B }, { deliver });
    await requestPasswordReset({ identifier: email, schoolId: null }, { deliver });
    expect(sent).toEqual([]);
  });

  it(`allows at most ${RESET_MAX_PER_HOUR} codes per hour`, async () => {
    await clearResets();
    for (let i = 0; i < RESET_MAX_PER_HOUR + 2; i++) {
      await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    }
    expect(sent).toHaveLength(RESET_MAX_PER_HOUR);
  });
});

describe("resetPassword", () => {
  it("only the newest code works", async () => {
    await clearResets();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    const first = lastCode();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    if (first !== lastCode()) {
      expect(await resetPassword({ identifier: email, schoolId: A, code: first, next: NEW, confirm: NEW })).toEqual({
        ok: false,
        problem: "invalidCode",
      });
    }
  });

  it(`stops after ${RESET_MAX_ATTEMPTS} wrong codes`, async () => {
    await clearResets();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    const good = lastCode();
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) {
      await resetPassword({ identifier: email, schoolId: A, code: wrong, next: NEW, confirm: NEW });
    }
    // Even the right code no longer works.
    expect(await resetPassword({ identifier: email, schoolId: A, code: good, next: NEW, confirm: NEW })).toEqual({
      ok: false,
      problem: "invalidCode",
    });
  });

  it("an expired code doesn't work", async () => {
    await clearResets();
    const t0 = new Date();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver, now: t0 });
    const later = new Date(t0.getTime() + (RESET_CODE_MINUTES + 1) * 60_000);
    expect(await resetPassword({ identifier: email, schoolId: A, code: lastCode(), next: NEW, confirm: NEW }, later)).toEqual({
      ok: false,
      problem: "invalidCode",
    });
  });

  it("a code from school A can't be used on school B", async () => {
    await clearResets();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    expect(await resetPassword({ identifier: email, schoolId: B, code: lastCode(), next: NEW, confirm: NEW })).toEqual({
      ok: false,
      problem: "invalidCode",
    });
  });

  it("a weak new password is refused without using up the code", async () => {
    await clearResets();
    await requestPasswordReset({ identifier: email, schoolId: A }, { deliver });
    expect(await resetPassword({ identifier: email, schoolId: A, code: lastCode(), next: "short1", confirm: "short1" })).toEqual({
      ok: false,
      problem: "tooShort",
    });
    // same code still works afterwards
    const r = await resetPassword({ identifier: email, schoolId: A, code: ` ${lastCode().slice(0, 3)} ${lastCode().slice(3)} `, next: NEW, confirm: NEW });
    expect(r).toEqual({ ok: true });
  });

  it("after a reset: new password works, old doesn't, other devices logged out, code is spent", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mustChangePassword).toBe(false);
    expect(user.sessionVersion).toBe(1);
    expect((await authenticate({ identifier: email, password: OLD, schoolId: A })).ok).toBe(false);
    expect((await authenticate({ identifier: email, password: NEW, schoolId: A })).ok).toBe(true);

    expect(await resetPassword({ identifier: email, schoolId: A, code: lastCode(), next: "Another-2026", confirm: "Another-2026" })).toEqual({
      ok: false,
      problem: "invalidCode",
    });
    expect(await db.auditLog.count({ where: { schoolId: A, action: "PASSWORD_RESET" } })).toBe(1);
  });
});
