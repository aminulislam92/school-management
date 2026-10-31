// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { savePlan, setPlanActive } from "./plans";

const run = Date.now().toString(36);
const created: number[] = [];
const base = { price: "999.00", billingCycle: "MONTHLY" as const, maxStudents: 200, features: ["fees" as const], isActive: true };

let actor: number;
beforeAll(async () => {
  actor = (await db.user.create({ data: { email: `plan-actor-${run}@x.test` } })).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { entity: "Plan", entityId: { in: created.map(String) } } });
  await db.plan.deleteMany({ where: { id: { in: created } } });
  await db.user.delete({ where: { id: actor } });
  await db.$disconnect();
});

describe("savePlan", () => {
  it("creates a plan and logs it", async () => {
    const r = await savePlan(null, { ...base, name: `Basic ${run}` }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    created.push(r.id);
    const plan = await db.plan.findUniqueOrThrow({ where: { id: r.id } });
    expect(plan.price.toString()).toBe("999");
    expect(plan.features).toEqual(["fees"]);
    expect(await db.auditLog.count({ where: { entity: "Plan", entityId: String(r.id), action: "CREATE" } })).toBe(1);
  });

  it("refuses a duplicate name, ignoring case", async () => {
    const r = await savePlan(null, { ...base, name: `BASIC ${run}` }, actor);
    expect(r).toEqual({ ok: false, errors: { name: "nameTaken" } });
  });

  it("updates a plan; keeping its own name is fine", async () => {
    const id = created[0];
    const r = await savePlan(id, { ...base, name: `Basic ${run}`, price: "1200.50", maxStudents: 300 }, actor);
    expect(r).toEqual({ ok: true, id });
    const plan = await db.plan.findUniqueOrThrow({ where: { id } });
    expect(plan.price.toString()).toBe("1200.5");
    expect(plan.maxStudents).toBe(300);
  });

  it("can't take another plan's name when editing", async () => {
    const other = await savePlan(null, { ...base, name: `Pro ${run}` }, actor);
    if (other.ok) created.push(other.id);
    expect(await savePlan(created[0], { ...base, name: `Pro ${run}` }, actor)).toEqual({ ok: false, errors: { name: "nameTaken" } });
  });

  it("editing a missing plan fails cleanly", async () => {
    expect(await savePlan(99_999_999, { ...base, name: `Ghost ${run}` }, actor)).toEqual({ ok: false, errors: { form: "notFound" } });
  });

  it("switches a plan off and on", async () => {
    await setPlanActive(created[0], false, actor);
    expect((await db.plan.findUniqueOrThrow({ where: { id: created[0] } })).isActive).toBe(false);
    await setPlanActive(created[0], true, actor);
    expect((await db.plan.findUniqueOrThrow({ where: { id: created[0] } })).isActive).toBe(true);
  });
});
