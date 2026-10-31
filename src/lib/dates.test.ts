import { describe, expect, it } from "vitest";
import { addDays, addMonths, dhakaDayEnd, dhakaDayStart, isYmd, periodEnd, toDhakaYmd } from "./dates";

describe("dates (Asia/Dhaka)", () => {
  it("checks real calendar dates", () => {
    expect(isYmd("2028-02-29")).toBe(true);
    expect(isYmd("2026-02-29")).toBe(false);
    expect(isYmd("2026-13-01")).toBe(false);
    expect(isYmd("1/11/2026")).toBe(false);
  });

  it("a Dhaka day starts at 18:00 UTC the day before", () => {
    expect(dhakaDayStart("2026-11-01").toISOString()).toBe("2026-10-31T18:00:00.000Z");
    expect(dhakaDayEnd("2026-11-01").toISOString()).toBe("2026-11-01T17:59:59.999Z");
  });

  it("finds the Dhaka date of a moment", () => {
    expect(toDhakaYmd(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-01"); // 00:30 in Dhaka
    expect(toDhakaYmd(new Date("2026-10-31T17:59:00Z"))).toBe("2026-10-31");
    expect(toDhakaYmd(dhakaDayEnd("2026-11-30"))).toBe("2026-11-30");
  });

  it("adds days and months", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 12)).toBe("2027-11-15");
  });

  it("gives the last day of a billing period", () => {
    expect(periodEnd("2026-11-01", "MONTHLY")).toBe("2026-11-30");
    expect(periodEnd("2026-11-15", "MONTHLY")).toBe("2026-12-14");
    expect(periodEnd("2026-11-01", "YEARLY")).toBe("2027-10-31");
    expect(periodEnd("2027-01-31", "MONTHLY")).toBe("2027-02-27"); // next period starts 28 Feb
  });
});

describe("date-only columns", () => {
  it("round-trips a calendar day through UTC midnight", async () => {
    const { dateOnly, ymdOf } = await import("./dates");
    expect(dateOnly("2026-07-01").toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(ymdOf(dateOnly("2027-06-30"))).toBe("2027-06-30");
  });
});
