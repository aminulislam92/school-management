import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can, isStaff, PERMISSIONS, permissionsFor } from "./permissions";

// The table in docs/03-routes.md §8, written as expectations.
// If you change permissions.ts on purpose, change this table (and the doc) too.
const EXPECTED: Record<string, Role[]> = {
  "settings.manage": ["ADMIN"],
  "academic.manage": ["ADMIN"],
  "student.read": ["ADMIN", "OFFICE_STAFF", "ACCOUNTANT", "TEACHER", "CLASS_TEACHER"],
  "student.write": ["ADMIN", "OFFICE_STAFF"],
  "staff.manage": ["ADMIN"],
  "attendance.take": ["ADMIN", "TEACHER", "CLASS_TEACHER"],
  "attendance.editPast": ["ADMIN"],
  "fee.setup": ["ADMIN"],
  "fee.collect": ["ADMIN", "ACCOUNTANT"],
  "payment.void": ["ADMIN"],
  "lateFee.waive": ["ADMIN"],
  "marks.enter": ["ADMIN", "TEACHER", "CLASS_TEACHER"],
  "result.process": ["ADMIN"],
  "result.review": ["ADMIN", "CLASS_TEACHER"],
  "result.publish": ["ADMIN"],
  "notice.manage": ["ADMIN"],
  "sms.send": ["ADMIN"],
  "report.finance": ["ADMIN", "ACCOUNTANT"],
  "audit.read": ["ADMIN"],
  "portal.fees": ["GUARDIAN"],
};

describe("permissions", () => {
  it.each(Object.entries(EXPECTED))("%s matches docs/03-routes.md", (permission, roles) => {
    expect([...PERMISSIONS[permission as keyof typeof PERMISSIONS]].sort()).toEqual([...roles].sort());
  });

  it("every permission belongs to at least one role", () => {
    for (const p of ALL_PERMISSIONS) expect(PERMISSIONS[p].length, p).toBeGreaterThan(0);
  });

  it("the super admin has no school permissions", () => {
    expect(permissionsFor(["SUPER_ADMIN"])).toEqual(["super.manage"]);
  });

  it("students and guardians can't do any staff work", () => {
    for (const role of ["STUDENT", "GUARDIAN"] as Role[]) {
      expect(permissionsFor([role]).every((p) => p.startsWith("portal."))).toBe(true);
    }
  });

  it("an accountant can collect fees but not change marks or void receipts", () => {
    expect(can(["ACCOUNTANT"], "fee.collect")).toBe(true);
    expect(can(["ACCOUNTANT"], "marks.enter")).toBe(false);
    expect(can(["ACCOUNTANT"], "payment.void")).toBe(false);
  });

  it("several roles add up", () => {
    expect(can(["TEACHER"], "result.review")).toBe(false);
    expect(can(["TEACHER", "CLASS_TEACHER"], "result.review")).toBe(true);
  });

  it("isStaff", () => {
    expect(isStaff(["TEACHER"])).toBe(true);
    expect(isStaff(["GUARDIAN"])).toBe(false);
    expect(isStaff(["SUPER_ADMIN"])).toBe(false);
  });
});
