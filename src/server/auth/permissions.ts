// Who may do what. One table for the whole app, from docs/03-routes.md §8.
//
// A permission answers "may this KIND of user do this KIND of thing?".
// Which ROWS they may touch (a teacher only their own sections, a guardian only
// their own children) is checked separately, next to the data, in each feature.
import type { Role } from "@prisma/client";

export const STAFF_ROLES = [
  "ADMIN",
  "OFFICE_STAFF",
  "ACCOUNTANT",
  "TEACHER",
  "CLASS_TEACHER",
] as const satisfies readonly Role[];

export const PORTAL_ROLES = ["STUDENT", "GUARDIAN"] as const satisfies readonly Role[];

const TEACHERS = ["TEACHER", "CLASS_TEACHER"] as const;

export const PERMISSIONS = {
  // Super admin (main site only)
  "super.manage": ["SUPER_ADMIN"],

  // School setup
  "settings.manage": ["ADMIN"],
  "academic.manage": ["ADMIN"],
  "user.manage": ["ADMIN"],
  "staff.manage": ["ADMIN"],

  // Students
  "student.read": [...STAFF_ROLES], // teachers: only their classes (row check)
  "student.write": ["ADMIN", "OFFICE_STAFF"],
  "certificate.print": ["ADMIN", "OFFICE_STAFF"],

  // Attendance
  "attendance.take": ["ADMIN", ...TEACHERS], // teachers: only assigned sections (row check)
  "attendance.editPast": ["ADMIN"],
  "attendance.report": ["ADMIN", "CLASS_TEACHER"],

  // Fees and accounts
  "fee.setup": ["ADMIN"],
  "fee.collect": ["ADMIN", "ACCOUNTANT"],
  "payment.void": ["ADMIN"],
  "lateFee.waive": ["ADMIN"],
  "expense.manage": ["ADMIN", "ACCOUNTANT"],
  "report.finance": ["ADMIN", "ACCOUNTANT"],

  // Exams and results
  "exam.manage": ["ADMIN"],
  "marks.enter": ["ADMIN", ...TEACHERS], // teachers: only assigned subjects (row check)
  "result.process": ["ADMIN"],
  "result.review": ["ADMIN", "CLASS_TEACHER"], // class teacher: own section (row check)
  "result.publish": ["ADMIN"],

  // Communication
  "notice.manage": ["ADMIN"],
  "sms.send": ["ADMIN"],

  // Oversight
  "audit.read": ["ADMIN"],

  // Portal (students and guardians)
  "portal.view": [...PORTAL_ROLES],
  "portal.fees": ["GUARDIAN"], // students too when the school setting allows it (checked in the page)
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** True if any of the user's roles has this permission. */
export function can(roles: readonly Role[], permission: Permission): boolean {
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}

/** Everything these roles may do — handy for building menus. */
export function permissionsFor(roles: readonly Role[]): Permission[] {
  return ALL_PERMISSIONS.filter((p) => can(roles, p));
}

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly Role[]).includes(r));
}

/** Thrown by server actions when the user lacks a permission. */
export class ForbiddenError extends Error {
  constructor(public permission: Permission) {
    super(`Forbidden: missing permission "${permission}"`);
    this.name = "ForbiddenError";
  }
}
