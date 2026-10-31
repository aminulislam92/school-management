import { describe, expect, it } from "vitest";
import { studentLoginAllowed } from "./student-login";

describe("studentLoginAllowed", () => {
  it("allows classes from the chosen one upward", () => {
    expect(studentLoginAllowed(9, 9)).toBe(true); // Class Six, from Six
    expect(studentLoginAllowed(9, 15)).toBe(true); // Twelve
    expect(studentLoginAllowed(9, 8)).toBe(false); // Five
  });
  it("is off when the school switched it off or the student has no class now", () => {
    expect(studentLoginAllowed(null, 12)).toBe(false);
    expect(studentLoginAllowed(9, null)).toBe(false);
  });
});
