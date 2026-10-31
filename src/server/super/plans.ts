// Subscription plans (super admin only). Rules + database access.
// Plans are never deleted — subscriptions point at them — only switched off.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PlanErrors, PlanInput } from "./plan-schema";

export * from "./plan-schema";

export function listPlans() {
  return db.plan.findMany({
    orderBy: [{ isActive: "desc" }, { price: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });
}

export function getPlan(id: number) {
  return db.plan.findUnique({ where: { id } });
}

export type SavePlanResult = { ok: true; id: number } | { ok: false; errors: PlanErrors };

/** Create (id = null) or update a plan. Names must be unique (ignoring case). */
export async function savePlan(id: number | null, input: PlanInput, actorId: number): Promise<SavePlanResult> {
  const clash = await db.plan.findFirst({
    where: { name: input.name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  // MySQL's utf8mb4_unicode_ci comparison already ignores case.
  if (clash) return { ok: false, errors: { name: "nameTaken" } };

  if (id && !(await db.plan.findUnique({ where: { id }, select: { id: true } }))) {
    return { ok: false, errors: { form: "notFound" } };
  }

  const data = {
    name: input.name,
    price: new Prisma.Decimal(input.price),
    billingCycle: input.billingCycle,
    maxStudents: input.maxStudents,
    features: input.features,
    isActive: input.isActive,
  };

  const plan = id
    ? await db.plan.update({ where: { id }, data })
    : await db.plan.create({ data });

  await db.auditLog.create({
    data: {
      schoolId: null,
      userId: actorId,
      action: id ? "UPDATE" : "CREATE",
      entity: "Plan",
      entityId: String(plan.id),
      after: { ...data, price: input.price },
    },
  });

  return { ok: true, id: plan.id };
}

export async function setPlanActive(id: number, isActive: boolean, actorId: number) {
  await db.plan.update({ where: { id }, data: { isActive } });
  await db.auditLog.create({
    data: {
      schoolId: null,
      userId: actorId,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entity: "Plan",
      entityId: String(id),
    },
  });
}
