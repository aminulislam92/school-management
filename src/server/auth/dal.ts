// Data Access Layer for auth: the one place that reads the login cookie.
// Every page/action that needs the user calls getCurrentUser() or requireUser().
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSchool, getTenantHost } from "@/lib/tenant";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token";
import { can, ForbiddenError, isStaff, type Permission } from "./permissions";

/** Where a user lands after login. */
export function homePathFor(roles: Role[]): string {
  if (roles.includes("SUPER_ADMIN")) return "/super";
  if (isStaff(roles)) return "/admin";
  return "/portal";
}

export async function createSession(payload: SessionPayload) {
  (await cookies()).set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    // No `domain`: the cookie stays on this exact host, so a login on one
    // school's site is never sent to another school's site.
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The verified session, only if it belongs to the site being visited. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const tenant = await getTenantHost();
  if (tenant.kind === "root") return session.sch === null ? session : null;

  const school = await getCurrentSchool();
  return school && session.sch === school.id ? session : null;
});

/**
 * The logged-in user, freshly loaded from the database on each request,
 * so a deactivated user is logged out on their next click.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findFirst({
    where: { id: session.uid, schoolId: session.sch, isActive: true },
    select: {
      id: true,
      schoolId: true,
      email: true,
      phone: true,
      username: true,
      mustChangePassword: true,
      roles: { select: { role: true } },
      staff: { select: { nameBn: true, nameEn: true } },
      student: { select: { nameBn: true, nameEn: true, studentCode: true } },
      guardian: { select: { name: true } },
    },
  });
  if (!user) return null;

  const { staff, student, guardian, ...rest } = user;
  return {
    ...rest,
    roles: user.roles.map((r) => r.role),
    nameBn: staff?.nameBn ?? student?.nameBn ?? guardian?.name ?? null,
    nameEn: staff?.nameEn ?? student?.nameEn ?? guardian?.name ?? user.email ?? user.username ?? "",
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Use at the top of every protected page and server action.
 * Not logged in → /login. Logged in but wrong role → their own home page.
 */
export async function requireUser(allowedRoles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (allowedRoles && !user.roles.some((r) => allowedRoles.includes(r))) {
    redirect(homePathFor(user.roles));
  }
  return user;
}

/**
 * For PAGES: logged in and allowed to do `permission`, else redirect
 * (to /login, or to the user's own home page).
 *   const user = await requirePermission("fee.collect");
 */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.roles, permission)) redirect(homePathFor(user.roles));
  return user;
}

/**
 * For SERVER ACTIONS: same check, but throws instead of redirecting, so a
 * forged form post can never run the action.
 *   const user = await assertPermission("payment.void");
 */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.roles, permission)) throw new ForbiddenError(permission);
  return user;
}
