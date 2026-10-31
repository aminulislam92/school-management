import { describe, expect, it } from "vitest";
import { normalizeBdPhone, toBanglaDigits, toEnglishDigits } from "./bangla";

describe("toBanglaDigits", () => {
  it("converts digits and keeps other characters", () => {
    expect(toBanglaDigits("2026-0001")).toBe("২০২৬-০০০১");
    expect(toBanglaDigits(5.25)).toBe("৫.২৫");
  });
});

describe("toEnglishDigits", () => {
  it("converts Bangla digits back", () => {
    expect(toEnglishDigits("রোল ১২")).toBe("রোল 12");
  });
});

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801812-345-678", "01812345678"],
    ["০১৯১২৩৪৫৬৭৮", "01912345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(["0171234567", "01212345678", "1712345678", "abc"])("rejects %s", (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
  });
});
