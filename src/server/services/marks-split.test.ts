import { describe, expect, it } from "vitest";
import { checkSplit, defaultPass, PRESETS, totalFull, withPass } from "./marks-split";

describe("marks split", () => {
  it("33% pass marks, rounded", () => {
    expect([100, 70, 50, 30, 25, 0].map(defaultPass)).toEqual([33, 23, 17, 10, 8, 0]);
  });

  it("fills missing pass marks and keeps given ones", () => {
    expect(withPass(PRESETS.creative70mcq30)).toEqual({ writtenFull: 70, writtenPass: 23, mcqFull: 30, mcqPass: 10, practicalFull: 0, practicalPass: 0 });
    expect(withPass(PRESETS.creative50mcq25practical25, { writtenPass: 20, mcqPass: null })).toMatchObject({ writtenPass: 20, mcqPass: 8, practicalPass: 8 });
    expect(totalFull(withPass(PRESETS.creative50mcq25practical25))).toBe(100);
  });

  it("checks the split", () => {
    expect(checkSplit(withPass(PRESETS.written100))).toBeNull();
    expect(checkSplit(withPass({ writtenFull: 0, mcqFull: 0, practicalFull: 0 }))).toEqual({ error: "noMarks" });
    expect(checkSplit({ ...withPass(PRESETS.creative70mcq30), mcqPass: 31 })).toEqual({ error: "passAboveFull", part: "mcq" });
    expect(checkSplit({ ...withPass(PRESETS.written100), writtenFull: -5 })).toEqual({ error: "negative", part: "written" });
    expect(checkSplit(withPass({ writtenFull: 150, mcqFull: 60, practicalFull: 0 }))).toEqual({ error: "tooMany" });
  });
});
