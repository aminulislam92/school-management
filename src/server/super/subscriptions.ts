// Subscriptions and their payments (super admin only). Uses the plain `db`:
// the super admin works across schools.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, dhakaDayEnd, dhakaDayStart, toDhakaYmd } from "@/lib/dates";
import type { FormErrors, PaymentInput, SubscriptionInput } from "./subscription-schema";

export * from "./subscription-schema";

// Still running (or about to): these can overlap a new subscription.
const OPEN = ["TRIAL", "ACTIVE", "GRACE", "SUSPENDED"] as const;

type Result = { ok: true; id: number } | { ok: false; errors: FormErrors };

/**
 * Gives a school a new subscription (a renewal, a plan change, or trial → paid).
 * If it starts while an older one is still running, the older one is cut off
 * at the new start, so a school never has two at the same time.
 * An unpaid trial, grace or suspended period that gets cut off is CANCELLED;
 * a paid ACTIVE one keeps its status (its payments stay with it).
 */
export async function createSubscription(input: SubscriptionInput, actorId: number): Promise<Result> {
  const [school, plan] = await Promise.all([
    db.school.findUnique({ where: { id: input.schoolId }, select: { id: true } }),
    db.plan.findUnique({ where: { id: input.planId }, select: { isActive: true } }),
  ]);
  if (!school) return { ok: false, errors: { form: "notFound" } };
  if (!plan?.isActive) return { ok: false, errors: { planId: "plan" } };

  const startsAt = dhakaDayStart(input.startsOn);
  const endsAt = dhakaDayEnd(input.endsOn);

  const id = await db.$transaction(async (tx) => {
    const overlapping = await tx.subscription.findMany({
      where: { schoolId: input.schoolId, status: { in: [...OPEN] }, endsAt: { gt: startsAt } },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    });
    for (const old of overlapping) {
      if (old.startsAt >= startsAt) {
        // It hasn't started before the new one: the new one replaces it completely.
        await tx.subscription.update({ where: { id: old.id }, data: { status: "CANCELLED" } });
      } else {
        await tx.subscription.update({
          where: { id: old.id },
          data: {
            endsAt: new Date(startsAt.getTime() - 1),
            status: old.status === "ACTIVE" ? "ACTIVE" : "CANCELLED",
          },
        });
      }
    }

    const sub = await tx.subscription.create({
      data: { schoolId: input.schoolId, planId: input.planId, status: input.status, startsAt, endsAt, note: input.note },
    });
    await tx.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: actorId,
        action: "CREATE",
        entity: "Subscription",
        entityId: String(sub.id),
        after: { planId: input.planId, status: input.status, startsOn: input.startsOn, endsOn: input.endsOn, cutOff: overlapping.map((o) => o.id) },
      },
    });
    return sub.id;
  });
  return { ok: true, id };
}

/** Records money received for a subscription. Payments are never deleted. */
export async function recordSubscriptionPayment(
  input: PaymentInput,
  actorId: number,
  schoolId: number,
  now = new Date(),
): Promise<Result> {
  if (input.paidOn > toDhakaYmd(now)) return { ok: false, errors: { paidOn: "future" } };
  // The subscription must belong to the school whose page the form was on.
  const sub = await db.subscription.findFirst({ where: { id: input.subscriptionId, schoolId }, select: { id: true } });
  if (!sub) return { ok: false, errors: { subscriptionId: "subscription" } };

  const payment = await db.$transaction(async (tx) => {
    const p = await tx.subscriptionPayment.create({
      data: {
        schoolId,
        subscriptionId: sub.id,
        amount: new Prisma.Decimal(input.amount),
        method: input.method,
        trxId: input.trxId,
        paidAt: dhakaDayStart(input.paidOn),
        note: input.note,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "CREATE",
        entity: "SubscriptionPayment",
        entityId: String(p.id),
        after: { subscriptionId: sub.id, amount: input.amount, method: input.method, trxId: input.trxId ?? null, paidOn: input.paidOn },
      },
    });
    return p;
  });
  return { ok: true, id: payment.id };
}

/**
 * Suggested dates for the next subscription: it starts the day after the
 * current one ends (or today, if that has passed) and runs one billing period.
 */
export async function nextSubscriptionDefaults(schoolId: number, now = new Date()) {
  const latest = await db.subscription.findFirst({
    where: { schoolId, status: { in: [...OPEN] } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true, planId: true, plan: { select: { price: true, billingCycle: true } } },
  });
  const today = toDhakaYmd(now);
  const afterLatest = latest ? addDays(toDhakaYmd(latest.endsAt), 1) : today;
  const startsOn = afterLatest > today ? afterLatest : today;
  return { startsOn, planId: latest?.planId ?? null, today };
}

/** The school's current subscription and every school with one ending within `days` (or already over). */
export async function listSubscriptionWatch(days = 30, now = new Date()) {
  const schools = await db.school.findMany({
    where: { status: { not: "CLOSED" } },
    select: {
      id: true,
      code: true,
      nameBn: true,
      status: true,
      subscriptions: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { endsAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          endsAt: true,
          plan: { select: { name: true, price: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });
  const limit = now.getTime() + days * 24 * 60 * 60_000;
  return schools
    .map(({ subscriptions, ...school }) => {
      const sub = subscriptions[0] ?? null;
      return {
        ...school,
        sub: sub && {
          ...sub,
          paid: sub.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0)),
          daysLeft: Math.ceil((sub.endsAt.getTime() - now.getTime()) / (24 * 60 * 60_000)),
        },
      };
    })
    .filter((s) => !s.sub || s.sub.endsAt.getTime() <= limit || s.sub.status === "GRACE" || s.sub.status === "SUSPENDED")
    .sort((a, b) => (a.sub?.endsAt.getTime() ?? 0) - (b.sub?.endsAt.getTime() ?? 0));
}
