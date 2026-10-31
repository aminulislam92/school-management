// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import { addHoliday, deleteHolidayRange, holidayYears, HolidayInput, listHolidays } from "./holidays";

const run = Date.now().toString(36);
let S: number;
let other: number;
let actor: number;
const input = (over: Record<string, string>) => HolidayInput.parse({ title: "ঈদুল ফিতর", from: "2027-03-29", to: "", ...over });

beforeAll(async () => {
  S = (await db.school.create({ data: { code: `hol-a-${run}`, nameBn: "A", nameEn: "A", levels: ["PRIMARY"] } })).id;
  other = (await db.school.create({ data: { code: `hol-b-${run}`, nameBn: "B", nameEn: "B", levels: ["PRIMARY"] } })).id;
  actor = (await db.user.create({ data: { schoolId: S, email: `hol-${run}@x.test` } })).id;
});

afterAll(async () => {
  const where = { schoolId: { in: [S, other] } };
  await db.holiday.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.school.deleteMany({ where: { id: { in: [S, other] } } });
  await db.$disconnect();
});

describe("form", () => {
  it("one day when 'to' is empty; checks order and length", () => {
    expect(input({})).toEqual({ title: "ঈদুল ফিতর", from: "2027-03-29", to: "2027-03-29" });
    expect(HolidayInput.safeParse({ title: "ক খ", from: "2027-03-29", to: "2027-03-28" }).success).toBe(false);
    expect(HolidayInput.safeParse({ title: "ক খ", from: "2027-01-01", to: "2027-03-02" }).success).toBe(false); // 61 days: too long
    expect(HolidayInput.safeParse({ title: "ক খ", from: "2027-01-01", to: "2027-03-01" }).success).toBe(true); // exactly 60 days
  });
});

describe("holidays", () => {
  it("adds a range as one row per day, shown as one range", async () => {
    const sdb = forSchool(S);
    expect(await addHoliday(sdb, S, input({ to: "2027-04-02" }), actor)).toEqual({ ok: true, days: 5 });
    expect(await addHoliday(sdb, S, input({ title: "শহীদ দিবস", from: "2027-02-21" }), actor)).toEqual({ ok: true, days: 1 });
    expect(await addHoliday(sdb, S, input({ title: "বিজয় দিবস", from: "2026-12-16" }), actor)).toEqual({ ok: true, days: 1 });
    expect(await listHolidays(sdb, 2027)).toEqual([
      { title: "শহীদ দিবস", from: "2027-02-21", to: "2027-02-21", days: 1 },
      { title: "ঈদুল ফিতর", from: "2027-03-29", to: "2027-04-02", days: 5 },
    ]);
    expect(await holidayYears(sdb)).toEqual([2026, 2027]);
  });

  it("refuses days that are already holidays, saving nothing", async () => {
    const sdb = forSchool(S);
    expect(await addHoliday(sdb, S, input({ title: "অন্য ছুটি", from: "2027-04-01", to: "2027-04-05" }), actor)).toEqual({
      ok: false,
      error: "taken:2027-04-01,2027-04-02",
      field: "from",
    });
    expect((await listHolidays(sdb, 2027)).map((r) => r.title)).toEqual(["শহীদ দিবস", "ঈদুল ফিতর"]);
  });

  it("each school has its own list", async () => {
    expect(await listHolidays(forSchool(other), 2027)).toEqual([]);
    expect((await addHoliday(forSchool(other), other, input({ to: "2027-03-30" }), actor)).ok).toBe(true); // same dates, other school: fine
    expect(await deleteHolidayRange(forSchool(other), other, "2027-02-21", "2027-02-21", "শহীদ দিবস", actor)).toEqual({ ok: false, error: "notFound" });
  });

  it("deletes one range", async () => {
    const sdb = forSchool(S);
    expect(await deleteHolidayRange(sdb, S, "2027-03-29", "2027-04-02", "ঈদুল ফিতর", actor)).toEqual({ ok: true, days: 5 });
    expect((await listHolidays(sdb, 2027)).map((r) => r.title)).toEqual(["শহীদ দিবস"]);
    expect((await listHolidays(forSchool(other), 2027)).map((r) => r.days)).toEqual([2]); // other school untouched
  });
});
