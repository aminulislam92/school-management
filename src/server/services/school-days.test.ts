import { describe, expect, it } from "vitest";
import { daysFrom, holidayRanges, isSchoolDay, weekdayOf } from "./school-days";

describe("school days", () => {
  it("knows the weekday of a calendar date", () => {
    expect(["2026-11-06", "2026-11-07", "2027-01-01"].map(weekdayOf)).toEqual(["FRI", "SAT", "FRI"]);
  });

  it("lists every day of a range, across months", () => {
    expect(daysFrom("2027-03-29", "2027-04-02")).toEqual(["2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02"]);
    expect(daysFrom("2026-02-21", "2026-02-21")).toEqual(["2026-02-21"]);
  });

  it("a school day is neither a weekly day off nor a holiday", () => {
    const holidays = new Set(["2026-12-16"]);
    expect(isSchoolDay("2026-12-15", ["FRI"], holidays)).toBe(true); // Tuesday
    expect(isSchoolDay("2026-12-16", ["FRI"], holidays)).toBe(false); // Victory Day
    expect(isSchoolDay("2026-12-18", ["FRI"], holidays)).toBe(false); // Friday
    expect(isSchoolDay("2026-12-19", ["SAT", "FRI"], holidays)).toBe(false); // Saturday
  });

  it("groups next-to-each-other days with the same name", () => {
    const rows = [
      { date: "2027-04-01", title: "ঈদ" },
      { date: "2027-03-30", title: "ঈদ" },
      { date: "2027-03-31", title: "ঈদ" },
      { date: "2027-02-21", title: "শহীদ দিবস" },
      { date: "2027-04-03", title: "ঈদ" }, // a gap → new range
      { date: "2027-04-04", title: "অন্য" },
    ];
    expect(holidayRanges(rows)).toEqual([
      { title: "শহীদ দিবস", from: "2027-02-21", to: "2027-02-21", days: 1 },
      { title: "ঈদ", from: "2027-03-30", to: "2027-04-01", days: 3 },
      { title: "ঈদ", from: "2027-04-03", to: "2027-04-03", days: 1 },
      { title: "অন্য", from: "2027-04-04", to: "2027-04-04", days: 1 },
    ]);
  });
});
