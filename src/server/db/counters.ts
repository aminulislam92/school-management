// Safe running numbers per school: Student IDs (2026-0001 …), receipt numbers …
// (SchoolCounter table, one row per school + key).
//
// Why not "read the last number, add 1"? Two office staff admitting at the same
// moment would both read 41 and both write 42. Instead:
//   1. make sure the counter row exists — INSERT IGNORE, which never fails, even
//      when two requests do it at the same time;
//   2. add 1 in the database. MySQL locks that row until the transaction ends, so
//      a second request waits there and then gets the next number.
// Call it INSIDE the transaction that saves the record using the number: if that
// transaction is rolled back (e.g. the roll is taken), the number is given back
// too, so the sequence has no gaps.
import "server-only";
import type { SchoolDb } from "./school-db";

/** The transaction client from `sdb.$transaction(async (tx) => …)` (or `sdb` itself in tests). */
export type CounterClient = { schoolCounter: SchoolDb["schoolCounter"] };

const KEY = /^[a-z]+(:\d{4})?$/; // "receipt", "student:2026"

export async function nextNumber(tx: CounterClient, schoolId: number, key: string): Promise<number> {
  if (!KEY.test(key)) throw new Error(`Bad counter key: ${key}`);
  await tx.schoolCounter.createMany({ data: [{ schoolId, key, value: 0 }], skipDuplicates: true });
  const row = await tx.schoolCounter.update({
    where: { schoolId_key: { schoolId, key } },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return row.value;
}

// ── Formats ─────────────────────────────────────────────────────────────

/** Student IDs restart every year: key "student:2026". */
export const studentCounterKey = (year: number) => `student:${year}`;

/** 2026, 7 → "2026-0007"; after 9999 it simply grows: "2026-10000". */
export const formatStudentCode = (year: number, n: number) => `${year}-${String(n).padStart(4, "0")}`;
