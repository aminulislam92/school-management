// "Forgot password": request a 6-digit code, then use it to set a new password.
// Uses the plain `db` with explicit schoolId filters (the user isn't logged in;
// the school comes from the domain).
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { parseIdentifier } from "./authenticate";
import { hashPassword } from "./password";
import { checkNewPassword, type PasswordProblem } from "./password-policy";
import { deliverResetCode, type DeliverResetCode } from "./reset-delivery";

export const RESET_CODE_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_MAX_PER_HOUR = 3;

export function generateResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC of the code, tied to the user, keyed with AUTH_SECRET. */
export function hashResetCode(userId: number, code: string, secret = process.env.AUTH_SECRET): string {
  if (!secret) throw new Error("AUTH_SECRET is missing. See .env.example.");
  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The user this identifier means on this site, if they can use password login. */
async function findResettableUser(identifier: string, schoolId: number | null) {
  const id = parseIdentifier(identifier);
  if (!id) return null;
  const user = await db.user.findFirst({
    where: { schoolId, [id.field]: id.value, isActive: true, passwordHash: { not: null } },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      roles: { select: { role: true } },
    },
  });
  if (!user) return null;
  const isSuper = user.roles.some((r) => r.role === "SUPER_ADMIN");
  // Same rule as login: super admin only on the main site, school users only on their school.
  if ((schoolId === null) !== isSuper) return null;
  return user;
}

/**
 * Step 1. Always "succeeds" from the caller's point of view, so the form can't
 * be used to find out which emails/phones exist.
 */
export async function requestPasswordReset(
  input: { identifier: string; schoolId: number | null },
  deps: { deliver?: DeliverResetCode; now?: Date } = {},
): Promise<void> {
  const now = deps.now ?? new Date();
  const user = await findResettableUser(input.identifier, input.schoolId);
  if (!user) return;

  const lastHour = await db.passwordReset.count({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
  });
  if (lastHour >= RESET_MAX_PER_HOUR) return;

  const code = generateResetCode();
  // A new code replaces any older unused one.
  await db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  await db.passwordReset.create({
    data: {
      userId: user.id,
      codeHash: hashResetCode(user.id, code),
      expiresAt: new Date(now.getTime() + RESET_CODE_MINUTES * 60_000),
      createdAt: now,
    },
  });

  await (deps.deliver ?? deliverResetCode)(
    { userId: user.id, email: user.email, phone: user.phone, username: user.username },
    code,
  );
}

export type ResetResult = { ok: true } | { ok: false; problem: "invalidCode" | PasswordProblem };

/** Step 2. Check the code and set the new password. */
export async function resetPassword(
  input: { identifier: string; schoolId: number | null; code: string; next: string; confirm: string },
  now = new Date(),
): Promise<ResetResult> {
  const user = await findResettableUser(input.identifier, input.schoolId);
  const reset = user
    ? await db.passwordReset.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!user || !reset || reset.attempts >= RESET_MAX_ATTEMPTS) {
    return { ok: false, problem: "invalidCode" };
  }

  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code) || !sameHash(hashResetCode(user.id, code), reset.codeHash)) {
    await db.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, problem: "invalidCode" };
  }

  // Code is right: now check the new password (a weak one doesn't use up the code).
  const problem = checkNewPassword({ next: input.next, confirm: input.confirm });
  if (problem) return { ok: false, problem };

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.next),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    }),
    db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    db.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: user.id,
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: String(user.id),
      },
    }),
  ]);

  return { ok: true };
}
