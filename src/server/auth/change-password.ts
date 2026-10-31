// Changing your own password. Uses the plain `db` with an explicit
// id + schoolId filter, because it serves both the super admin (no school)
// and school users.
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { checkNewPassword, type PasswordProblem } from "./password-policy";

export type ChangePasswordResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; problem: PasswordProblem | "wrongCurrent" | "noUser" };

export async function changePassword(input: {
  userId: number;
  schoolId: number | null;
  current: string;
  next: string;
  confirm: string;
}): Promise<ChangePasswordResult> {
  const user = await db.user.findFirst({
    where: { id: input.userId, schoolId: input.schoolId, isActive: true },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) return { ok: false, problem: "noUser" };

  if (!(await verifyPassword(input.current, user.passwordHash))) {
    return { ok: false, problem: "wrongCurrent" };
  }

  const problem = checkNewPassword(input);
  if (problem) return { ok: false, problem };

  const passwordHash = await hashPassword(input.next);

  const [updated] = await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 }, // every other device is logged out
      },
      select: { sessionVersion: true },
    }),
    db.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: user.id,
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: String(user.id),
      },
    }),
  ]);

  return { ok: true, sessionVersion: updated.sessionVersion };
}
