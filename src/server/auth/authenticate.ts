// Checks a login attempt. Uses the plain `db` on purpose: the user isn't
// logged in yet, so we scope by the schoolId taken from the domain instead.
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeBdPhone, toEnglishDigits } from "@/lib/bangla";
import { studentLoginAllowed } from "@/server/services/student-login";
import { burnPasswordCheck, verifyPassword } from "./password";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type Identifier = { field: "email" | "phone" | "username"; value: string };

/** "admin@x.com" → email, "01712345678" → phone, "2026-0001" → username (Student ID). */
export function parseIdentifier(raw: string): Identifier | null {
  const value = toEnglishDigits(raw.trim());
  if (!value) return null;
  if (value.includes("@")) return { field: "email", value: value.toLowerCase() };
  const phone = normalizeBdPhone(value);
  if (phone) return { field: "phone", value: phone };
  return { field: "username", value };
}

export type AuthUser = {
  id: number;
  schoolId: number | null;
  roles: Role[];
  mustChangePassword: boolean;
  sessionVersion: number;
};

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; lockedUntil: Date }
  | { ok: false; reason: "inactive" }
  | { ok: false; reason: "studentLoginOff" };

/**
 * @param schoolId the school of the domain being used, or null on the main site.
 *   On the main site only SUPER_ADMIN can log in; on a school site only that
 *   school's users can.
 */
export async function authenticate(
  input: { identifier: string; password: string; schoolId: number | null },
  now = new Date(),
): Promise<AuthResult> {
  const id = parseIdentifier(input.identifier);
  const user = id
    ? await db.user.findFirst({
        where: { schoolId: input.schoolId, [id.field]: id.value },
        include: { roles: { select: { role: true } } },
      })
    : null;

  const roles = user?.roles.map((r) => r.role) ?? [];
  const allowedHere =
    input.schoolId === null ? roles.includes("SUPER_ADMIN") : !roles.includes("SUPER_ADMIN");

  if (!user || !user.passwordHash || !allowedHere) {
    await burnPasswordCheck(input.password);
    return { ok: false, reason: "invalid" };
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false, reason: "locked", lockedUntil: user.lockedUntil };
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil },
      });
      return { ok: false, reason: "locked", lockedUntil };
    }
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: failed } });
    return { ok: false, reason: "invalid" };
  }

  // Password is right. Only now reveal that the account is switched off.
  if (!user.isActive) return { ok: false, reason: "inactive" };

  // A student (with no staff role) logs in only if the school allows their class.
  if (user.schoolId !== null && roles.length > 0 && roles.every((r) => r === "STUDENT")) {
    if (!(await studentMayLogIn(user.id, user.schoolId))) return { ok: false, reason: "studentLoginOff" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      schoolId: user.schoolId,
      roles,
      mustChangePassword: user.mustChangePassword,
      sessionVersion: user.sessionVersion,
    },
  };
}

/** The school's "students log in from class X" setting vs. the student's class this session. */
async function studentMayLogIn(userId: number, schoolId: number): Promise<boolean> {
  const [setting, enrollment] = await Promise.all([
    db.schoolSetting.findUnique({ where: { schoolId }, select: { studentLoginFromOrder: true } }),
    db.enrollment.findFirst({
      where: { schoolId, status: "ACTIVE", student: { userId, status: "ACTIVE" }, session: { isCurrent: true } },
      orderBy: { id: "desc" },
      select: { class: { select: { order: true } } },
    }),
  ]);
  return studentLoginAllowed(setting?.studentLoginFromOrder ?? null, enrollment?.class.order ?? null);
}
