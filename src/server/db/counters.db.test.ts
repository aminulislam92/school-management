// npm run test:db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { formatStudentCode, nextNumber, studentCounterKey } from "./counters";
import { forSchool } from "./school-db";

const run = Date.now().toString(36);
let A: number;
let B: number;
const slow = { maxWait: 30_000, timeout: 30_000 }; // many transactions wait for each other here
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One "admission": a transaction that takes the next number. */
const takeOne = (schoolId: number, key: string) => forSchool(schoolId).$transaction((tx) => nextNumber(tx, schoolId, key), slow);

beforeAll(async () => {
  A = (await db.school.create({ data: { code: `cnt-a-${run}`, nameBn: "A", nameEn: "A", levels: [] } })).id;
  B = (await db.school.create({ data: { code: `cnt-b-${run}`, nameBn: "B", nameEn: "B", levels: [] } })).id;
});

afterAll(async () => {
  await db.schoolCounter.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await db.school.deleteMany({ where: { id: { in: [A, B] } } });
  await db.$disconnect();
});

describe("nextNumber", () => {
  it("counts per school and per key", async () => {
    expect([await takeOne(A, "receipt"), await takeOne(A, "receipt"), await takeOne(A, "receipt")]).toEqual([1, 2, 3]);
    expect(await takeOne(A, studentCounterKey(2026))).toBe(1); // another key starts at 1
    expect(await takeOne(B, "receipt")).toBe(1); // another school starts at 1
    expect(await takeOne(A, "receipt")).toBe(4);
  });

  it("30 admissions at the same moment get 1…30, no number twice", async () => {
    const key = studentCounterKey(2027); // brand new: even creating the counter row races
    const numbers = await Promise.all(Array.from({ length: 30 }, () => takeOne(A, key)));
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("a failed admission gives its number back (no gaps)", async () => {
    const key = studentCounterKey(2028);
    expect(await takeOne(A, key)).toBe(1);
    await expect(
      forSchool(A).$transaction(async (tx) => {
        expect(await nextNumber(tx, A, key)).toBe(2);
        throw new Error("roll already taken"); // → rollback
      }),
    ).rejects.toThrow("roll already taken");
    expect(await takeOne(A, key)).toBe(2); // 2 again, not 3
  });

  it("refuses odd keys", async () => {
    await expect(takeOne(A, "Student 2026")).rejects.toThrow("Bad counter key");
  });

  it("why this matters: the naive 'read, then write +1' hands out duplicates", async () => {
    const key = "naive";
    await db.schoolCounter.create({ data: { schoolId: A, key, value: 0 } });
    const naive = async () => {
      const row = await db.schoolCounter.findUniqueOrThrow({ where: { schoolId_key: { schoolId: A, key } } });
      await sleep(20); // the gap between reading and writing (a real request has one too)
      await db.schoolCounter.update({ where: { id: row.id }, data: { value: row.value + 1 } });
      return row.value + 1;
    };
    const numbers = await Promise.all(Array.from({ length: 10 }, naive));
    expect(new Set(numbers).size).toBeLessThan(10); // some got the same number
  });
});

describe("formats", () => {
  it("Student ID", () => {
    expect(formatStudentCode(2026, 7)).toBe("2026-0007");
    expect(formatStudentCode(2026, 1234)).toBe("2026-1234");
    expect(formatStudentCode(2026, 10000)).toBe("2026-10000");
  });
});
