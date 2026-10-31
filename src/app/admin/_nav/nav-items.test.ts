import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { activeHref } from "@/components/shell/nav-types";
import { NAV, navFor } from "./nav-items";

const keys = (roles: Role[]) => navFor(roles).flatMap((g) => g.items.map((i) => i.key));

describe("navFor", () => {
  it("admin sees every item", () => {
    expect(keys(["ADMIN"])).toHaveLength(NAV.flatMap((g) => g.items).length);
  });

  it("accountant sees fees and finance, not marks or settings", () => {
    expect(keys(["ACCOUNTANT"])).toEqual([
      "dashboard",
      "students",
      "collectFees",
      "financeReports",
      "expenses",
    ]);
  });

  it("teacher sees students, attendance and marks only", () => {
    expect(keys(["TEACHER"])).toEqual(["dashboard", "students", "attendance", "marks"]);
  });

  it("class teacher also sees results", () => {
    expect(keys(["TEACHER", "CLASS_TEACHER"])).toContain("results");
  });

  it("office staff sees students but no money or settings", () => {
    const k = keys(["OFFICE_STAFF"]);
    expect(k).toContain("students");
    expect(k).not.toContain("collectFees");
    expect(k).not.toContain("settings");
  });

  it("drops groups that end up empty", () => {
    expect(navFor(["TEACHER"]).map((g) => g.key)).toEqual(["main", "daily"]);
  });

  it("hrefs are unique and all start with /admin", () => {
    const hrefs = NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith("/admin"))).toBe(true);
  });
});

describe("activeHref", () => {
  const hrefs = ["/admin", "/admin/fees/collect", "/admin/fees/reports", "/admin/students"];

  it.each([
    ["/admin", "/admin"],
    ["/admin/students", "/admin/students"],
    ["/admin/students/42/edit", "/admin/students"],
    ["/admin/fees/collect", "/admin/fees/collect"],
    ["/admin/studentsx", "/admin"],
    ["/portal", null],
  ])("%s → %s", (path, expected) => {
    expect(activeHref(path, hrefs)).toBe(expected);
  });
});
