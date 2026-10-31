// Proves that one school can never read or change another school's data.
// Runs against your local MySQL: npm run test:db
// It creates two throw-away schools and deletes them again at the end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { forSchool, isNotFoundError, type SchoolDb } from "./school-db";
import { TenantViolationError } from "./tenant-scope";

const run = Date.now().toString(36);
let A: number;
let B: number;
let sdbA: SchoolDb;
let groupB: number;
let gradeScaleA: number;
let gradeScaleB: number;
let classB: number;
let subjectA: number;

async function makeSchool(code: string) {
  const s = await db.school.create({
    data: { code, nameBn: code, nameEn: code, levels: ["SECONDARY"] },
  });
  return s.id;
}

beforeAll(async () => {
  A = await makeSchool(`test-a-${run}`);
  B = await makeSchool(`test-b-${run}`);
  sdbA = forSchool(A);

  await db.group.createMany({
    data: [
      { schoolId: A, nameBn: "বিজ্ঞান", nameEn: "Science" },
      { schoolId: B, nameBn: "বিজ্ঞান", nameEn: "Science" },
      { schoolId: B, nameBn: "মানবিক", nameEn: "Humanities" },
    ],
  });
  groupB = (await db.group.findFirstOrThrow({ where: { schoolId: B } })).id;

  gradeScaleA = (await db.gradeScale.create({ data: { schoolId: A, name: "A scale" } })).id;
  gradeScaleB = (
    await db.gradeScale.create({
      data: {
        schoolId: B,
        name: "B scale",
        items: { create: { minPercent: "80", maxPercent: "100", letter: "A+", point: "5.00" } },
      },
    })
  ).id;

  classB = (
    await db.schoolClass.create({
      data: { schoolId: B, nameBn: "ষষ্ঠ", nameEn: "Six", level: "SECONDARY", order: 9 },
    })
  ).id;
  subjectA = (
    await db.subject.create({ data: { schoolId: A, nameBn: "বাংলা", nameEn: "Bangla", code: "101" } })
  ).id;
});

afterAll(async () => {
  const ids = [A, B].filter(Boolean);
  await db.classSubject.deleteMany({ where: { class: { schoolId: { in: ids } } } });
  await db.subject.deleteMany({ where: { schoolId: { in: ids } } });
  await db.schoolClass.deleteMany({ where: { schoolId: { in: ids } } });
  await db.gradeScaleItem.deleteMany({ where: { gradeScale: { schoolId: { in: ids } } } });
  await db.gradeScale.deleteMany({ where: { schoolId: { in: ids } } });
  await db.group.deleteMany({ where: { schoolId: { in: ids } } });
  await db.holiday.deleteMany({ where: { schoolId: { in: ids } } });
  await db.school.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe("reading", () => {
  it("findMany returns only this school's rows", async () => {
    const groups = await sdbA.group.findMany();
    expect(groups.map((g) => g.schoolId)).toEqual([A]);
  });

  it("an explicit filter for another school still returns nothing", async () => {
    expect(await sdbA.group.findMany({ where: { schoolId: B } })).toEqual([]);
  });

  it("findUnique of another school's id is null", async () => {
    expect(await sdbA.group.findUnique({ where: { id: groupB } })).toBeNull();
  });

  it("compound unique key of another school is null", async () => {
    const row = await sdbA.group.findUnique({
      where: { schoolId_nameEn: { schoolId: B, nameEn: "Humanities" } },
    });
    expect(row).toBeNull();
  });

  it("count and aggregate only see this school", async () => {
    expect(await sdbA.group.count()).toBe(1);
    const agg = await sdbA.group.aggregate({ _count: { _all: true } });
    expect(agg._count._all).toBe(1);
  });

  it("child tables are filtered through their parent", async () => {
    expect(await sdbA.gradeScaleItem.findMany()).toEqual([]);
    expect(await db.gradeScaleItem.count({ where: { gradeScaleId: gradeScaleB } })).toBe(1);
  });

  it("School: only its own row", async () => {
    const schools = await sdbA.school.findMany();
    expect(schools.map((s) => s.id)).toEqual([A]);
  });
});

describe("changing", () => {
  it("update of another school's row fails as not found", async () => {
    const err = await sdbA.group
      .update({ where: { id: groupB }, data: { nameEn: "Hacked" } })
      .catch((e) => e);
    expect(isNotFoundError(err)).toBe(true);
    expect((await db.group.findUniqueOrThrow({ where: { id: groupB } })).nameEn).not.toBe("Hacked");
  });

  it("delete of another school's row fails as not found", async () => {
    const err = await sdbA.group.delete({ where: { id: groupB } }).catch((e) => e);
    expect(isNotFoundError(err)).toBe(true);
    expect(await db.group.count({ where: { id: groupB } })).toBe(1);
  });

  it("updateMany and deleteMany touch only this school", async () => {
    const res = await sdbA.group.updateMany({ data: { nameBn: "বিজ্ঞান ১" } });
    expect(res.count).toBe(1);
    const del = await sdbA.holiday.deleteMany({});
    expect(del.count).toBe(0);
    expect(await db.group.count({ where: { schoolId: B, nameBn: "বিজ্ঞান ১" } })).toBe(0);
  });

  it("schoolId can't be moved to another school", async () => {
    const own = await sdbA.group.findFirstOrThrow();
    await expect(
      sdbA.group.update({ where: { id: own.id }, data: { schoolId: B } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });

  it("School: code and status can't be changed from a school", async () => {
    await expect(
      sdbA.school.update({ where: { id: A }, data: { status: "ACTIVE" } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });
});

describe("creating", () => {
  it("fills in schoolId when it is missing", async () => {
    const h = await sdbA.holiday.create({
      data: { date: new Date("2026-12-16"), title: "বিজয় দিবস" } as never,
    });
    expect(h.schoolId).toBe(A);
  });

  it("refuses a schoolId of another school", async () => {
    await expect(
      sdbA.holiday.create({ data: { schoolId: B, date: new Date("2026-03-26"), title: "x" } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });

  it("createMany checks every row", async () => {
    await expect(
      sdbA.holiday.createMany({
        data: [
          { schoolId: A, date: new Date("2026-02-21"), title: "ok" },
          { schoolId: B, date: new Date("2026-02-22"), title: "bad" },
        ],
      }),
    ).rejects.toBeInstanceOf(TenantViolationError);
    expect(await db.holiday.count({ where: { title: { in: ["ok", "bad"] } } })).toBe(0);
  });

  it("child row needs a parent from this school", async () => {
    await expect(
      sdbA.gradeScaleItem.create({
        data: { gradeScaleId: gradeScaleB, minPercent: "0", maxPercent: "32", letter: "F", point: "0" },
      }),
    ).rejects.toBeInstanceOf(TenantViolationError);

    const ok = await sdbA.gradeScaleItem.create({
      data: { gradeScaleId: gradeScaleA, minPercent: "0", maxPercent: "32", letter: "F", point: "0" },
    });
    expect(ok.gradeScaleId).toBe(gradeScaleA);
  });

  it("child row can't point at another school's parent", async () => {
    await expect(
      sdbA.classSubject.create({ data: { classId: classB, subjectId: subjectA } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });

  it("global tables can't be created from a school", async () => {
    await expect(
      sdbA.plan.create({
        data: { name: "x", price: "1", billingCycle: "MONTHLY", maxStudents: 1, features: [] },
      }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });
});
