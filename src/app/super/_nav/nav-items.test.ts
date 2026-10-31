import { describe, expect, it } from "vitest";
import { filterNav } from "@/components/shell/nav-types";
import { SUPER_NAV } from "./nav-items";

describe("super admin menu", () => {
  it("the super admin sees every item", () => {
    const keys = filterNav(SUPER_NAV, ["SUPER_ADMIN"]).flatMap((g) => g.items.map((i) => i.key));
    expect(keys).toEqual(["superDashboard", "schools", "plans", "subscriptions"]);
  });

  it("school users see nothing", () => {
    for (const role of ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT"] as const) {
      expect(filterNav(SUPER_NAV, [role])).toEqual([]);
    }
  });

  it("every link stays under /super", () => {
    expect(SUPER_NAV.flatMap((g) => g.items).every((i) => i.href.startsWith("/super"))).toBe(true);
  });
});
