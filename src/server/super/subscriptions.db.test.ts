// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toDhakaYmd } from "@/lib/dates";
import { NewSchoolInput } from "./school-schema";
import { createSchool } from "./schools";
import {
  createSubscription,
  listSubscriptionWatch,
  nextSubscriptionDefaults,
  PaymentInput,
  recordSubscriptionPayment,
  SubscriptionInput,
} from "./subscriptions";

const run = Date.now().toString(36);
let actor: number;
let monthly: number;
let yearly: number;
let off: number;
let schoolId: number;
let otherSchoolId: number;

const rawSub = (over: Record<string, unknown> = {}) =>
  ({ schoolId: String(schoolId), planId: String(monthly), status: "ACTIVE", startsOn: "2026-11-01", endsOn: "2026-11-30", note: "", ...over });
const sub = (over: Record<string, unknown> = {}) => SubscriptionInput.parse(rawSub(over));
// What the form sends, and the cleaned version.
const rawPay = (over: Record<string, unknown> = {}) =>
  ({ subscriptionId: "1", amount: "1,500", method: "BKASH", trxId: "abc123", paidOn: "2026-11-01", note: "", ...over });
const pay = (over: Record<string, unknown> = {}) => PaymentInput.parse(rawPay(over));
const subsOf = (id: number) => db.subscription.findMany({ where: { schoolId: id }, orderBy: { id: "asc" } });

beforeAll(async () => {
  actor = (await db.user.create({ data: { email: `sub-actor-${run}@x.test` } })).id;
  const base = { maxStudents: 100, features: [] };
  monthly = (await db.plan.create({ data: { ...base, name: `M ${run}`, price: "1500", billingCycle: "MONTHLY" } })).id;
  yearly = (await db.plan.create({ data: { ...base, name: `Y ${run}`, price: "15000", billingCycle: "YEARLY" } })).id;
  off = (await db.plan.create({ data: { ...base, name: `O ${run}`, price: "1", billingCycle: "MONTHLY", isActive: false } })).id;
  const make = async (code: string) => {
    const r = await createSchool(
      NewSchoolInput.parse({
        code, nameBn: "সাব টেস্ট", nameEn: "Sub Test", eiin: "", board: "", levels: ["PRIMARY"], phone: "", email: "",
        district: "", upazila: "", planId: monthly, trialDays: "30", adminNameEn: "Admin", adminNameBn: "",
        adminEmail: `${code}@x.test`, adminPhone: "",
      }),
      actor,
      new Date("2026-10-20T06:00:00Z"), // trial: 20 Oct – 19 Nov
    );
    if (!r.ok) throw new Error("setup");
    return r.schoolId;
  };
  schoolId = await make(`sub-${run}`);
  otherSchoolId = await make(`sub2-${run}`);
});

afterAll(async () => {
  for (const id of [schoolId, otherSchoolId]) {
    const where = { schoolId: id };
    await db.auditLog.deleteMany({ where });
    await db.subscriptionPayment.deleteMany({ where });
    await db.subscription.deleteMany({ where });
    await db.userRole.deleteMany({ where: { user: where } });
    await db.staff.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.academicSession.deleteMany({ where });
    await db.gradeScaleItem.deleteMany({ where: { gradeScale: where } });
    await db.gradeScale.deleteMany({ where });
    await db.smsTemplate.deleteMany({ where });
    await db.feeType.deleteMany({ where });
    await db.group.deleteMany({ where });
    await db.schoolClass.deleteMany({ where });
    await db.schoolSetting.deleteMany({ where });
    await db.school.delete({ where: { id: id } });
  }
  await db.plan.deleteMany({ where: { id: { in: [monthly, yearly, off] } } });
  await db.user.delete({ where: { id: actor } });
  await db.$disconnect();
});

describe("createSubscription", () => {
  it("trial → paid: the trial is cut off the day before and cancelled", async () => {
    const r = await createSubscription(sub(), actor);
    expect(r.ok).toBe(true);
    const [trial, paid] = await subsOf(schoolId);
    expect(trial.status).toBe("CANCELLED");
    expect(toDhakaYmd(trial.endsAt)).toBe("2026-10-31");
    expect(paid.status).toBe("ACTIVE");
    expect([toDhakaYmd(paid.startsAt), toDhakaYmd(paid.endsAt)]).toEqual(["2026-11-01", "2026-11-30"]);
    expect(paid.startsAt.toISOString()).toBe("2026-10-31T18:00:00.000Z"); // midnight in Dhaka
    expect(await db.auditLog.count({ where: { schoolId, entity: "Subscription" } })).toBe(1);
  });

  it("suggests the renewal to start the day after the current one ends", async () => {
    const d = await nextSubscriptionDefaults(schoolId, new Date("2026-11-10T06:00:00Z"));
    expect(d).toEqual({ startsOn: "2026-12-01", planId: monthly, today: "2026-11-10" });
    // Long expired → starts today.
    expect((await nextSubscriptionDefaults(schoolId, new Date("2027-03-05T06:00:00Z"))).startsOn).toBe("2027-03-05");
  });

  it("a renewal after the end leaves the old one alone", async () => {
    await createSubscription(sub({ planId: yearly, startsOn: "2026-12-01", endsOn: "2027-11-30" }), actor);
    const [, paid, renewal] = await subsOf(schoolId);
    expect([paid.status, toDhakaYmd(paid.endsAt)]).toEqual(["ACTIVE", "2026-11-30"]);
    expect(renewal.planId).toBe(yearly);
  });

  it("a paid subscription cut short keeps ACTIVE; one that hadn't started is cancelled", async () => {
    await createSubscription(sub({ startsOn: "2026-11-15", endsOn: "2026-12-14" }), actor);
    const [, paid, renewal, latest] = await subsOf(schoolId);
    expect([paid.status, toDhakaYmd(paid.endsAt)]).toEqual(["ACTIVE", "2026-11-14"]);
    expect(renewal.status).toBe("CANCELLED");
    expect(latest.status).toBe("ACTIVE");
  });

  it("refuses a switched-off plan, an unknown school and bad dates", async () => {
    expect(await createSubscription(sub({ planId: off }), actor)).toEqual({ ok: false, errors: { planId: "plan" } });
    expect(await createSubscription(sub({ schoolId: 99_999_999 }), actor)).toEqual({ ok: false, errors: { form: "notFound" } });
    expect(SubscriptionInput.safeParse(rawSub()).success).toBe(true);
    expect(SubscriptionInput.safeParse(rawSub({ endsOn: "2026-10-01" })).success).toBe(false);
    expect(SubscriptionInput.safeParse(rawSub({ startsOn: "2026-02-30" })).success).toBe(false);
    expect(SubscriptionInput.safeParse(rawSub({ status: "GRACE" })).success).toBe(false);
  });
});

describe("recordSubscriptionPayment", () => {
  it("saves the exact amount, upper-cases the TrxID, and logs it", async () => {
    const s = (await subsOf(schoolId))[1];
    const now = new Date("2026-11-05T06:00:00Z");
    const r = await recordSubscriptionPayment(pay({ subscriptionId: s.id, amount: "1,500.50" }), actor, schoolId, now);
    expect(r.ok).toBe(true);
    const p = await db.subscriptionPayment.findFirstOrThrow({ where: { subscriptionId: s.id } });
    expect([p.amount.toString(), p.trxId, p.method, toDhakaYmd(p.paidAt)]).toEqual(["1500.5", "ABC123", "BKASH", "2026-11-01"]);
    expect(await db.auditLog.count({ where: { schoolId, entity: "SubscriptionPayment" } })).toBe(1);
  });

  it("refuses another school's subscription and future dates", async () => {
    const s = (await subsOf(schoolId))[1];
    const now = new Date("2026-11-05T06:00:00Z");
    expect(await recordSubscriptionPayment(pay({ subscriptionId: s.id }), actor, otherSchoolId, now)).toEqual({
      ok: false,
      errors: { subscriptionId: "subscription" },
    });
    expect(await recordSubscriptionPayment(pay({ subscriptionId: s.id, paidOn: "2026-11-06" }), actor, schoolId, now)).toEqual({
      ok: false,
      errors: { paidOn: "future" },
    });
  });

  it("checks the form", () => {
    expect(PaymentInput.safeParse(rawPay()).success).toBe(true);
    expect(PaymentInput.safeParse(rawPay({ amount: "0" })).success).toBe(false);
    expect(PaymentInput.safeParse(rawPay({ amount: "12.345" })).success).toBe(false);
    expect(PaymentInput.safeParse(rawPay({ trxId: "" })).success).toBe(false); // bKash needs a TrxID
    expect(PaymentInput.safeParse(rawPay({ method: "CASH", trxId: "" })).success).toBe(true);
  });
});

describe("listSubscriptionWatch", () => {
  it("lists schools whose subscription ends soon, soonest first", async () => {
    const rows = await listSubscriptionWatch(30, new Date("2026-11-10T06:00:00Z"));
    const other = rows.find((r) => r.id === otherSchoolId); // trial ends 19 Nov
    expect(other?.sub?.status).toBe("TRIAL");
    expect(other?.sub?.daysLeft).toBe(9);
    expect(rows.find((r) => r.id === schoolId)).toBeUndefined(); // ends 14 Dec: more than 30 days away
    const wider = await listSubscriptionWatch(40, new Date("2026-11-10T06:00:00Z"));
    expect(wider.find((r) => r.id === schoolId)?.sub?.paid.toString()).toBe("0"); // the latest one has no payment yet
    const ends = rows.map((r) => r.sub?.endsAt.getTime() ?? 0);
    expect([...ends].sort((a, b) => a - b)).toEqual(ends);
  });
});
