import { describe, expect, it } from "vitest";
import { parsePlanForm, planErrors } from "./plan-schema";

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return fd;
}

const good = {
  name: "Basic",
  price: "1,500.50",
  billingCycle: "MONTHLY",
  maxStudents: "500",
  features: ["attendance", "fees"],
  isActive: "on",
};

describe("parsePlanForm", () => {
  it("accepts a valid plan and cleans the values", () => {
    const r = parsePlanForm(form(good));
    expect(r.success && r.data).toEqual({
      name: "Basic",
      price: "1500.50",
      billingCycle: "MONTHLY",
      maxStudents: 500,
      features: ["attendance", "fees"],
      isActive: true,
    });
  });

  it("unchecked 'active' box means inactive; unknown features are dropped", () => {
    const { isActive: _ignored, ...rest } = good;
    void _ignored;
    const r = parsePlanForm(form({ ...rest, features: ["fees", "hacking"] }));
    expect(r.success && r.data.isActive).toBe(false);
    expect(r.success && r.data.features).toEqual(["fees"]);
  });

  it.each([
    [{ name: "x" }, "name"],
    [{ price: "abc" }, "price"],
    [{ price: "-5" }, "price"],
    [{ price: "10.123" }, "price"],
    [{ billingCycle: "WEEKLY" }, "billingCycle"],
    [{ maxStudents: "0" }, "maxStudents"],
    [{ maxStudents: "12.5" }, "maxStudents"],
  ])("rejects %o", (change, field) => {
    const r = parsePlanForm(form({ ...good, ...change }));
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(planErrors(r.error))).toContain(field);
  });
});
