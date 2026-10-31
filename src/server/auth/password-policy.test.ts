import { describe, expect, it } from "vitest";
import { checkNewPassword } from "./password-policy";

const ok = (next: string, current = "Old-pass-1") => checkNewPassword({ next, confirm: next, current });

describe("checkNewPassword", () => {
  it("accepts a reasonable password", () => {
    expect(ok("Dhaka2026school")).toBeNull();
    expect(ok("আমার-স্কুল-২০২৬")).toBeNull(); // Bangla letters and digits count too
  });

  it.each([
    ["short1", "tooShort"],
    ["onlyletters", "needsLetterAndNumber"],
    ["1234567890123", "needsLetterAndNumber"],
    ["Password123", "tooCommon"],
    ["BANGLADESH1", "tooCommon"],
    ["x1".repeat(51), "tooLong"],
  ])("%s → %s", (next, problem) => {
    expect(ok(next)).toBe(problem);
  });

  it("must differ from the current password", () => {
    expect(ok("Old-pass-1", "Old-pass-1")).toBe("sameAsOld");
  });

  it("confirmation must match", () => {
    expect(checkNewPassword({ next: "Dhaka2026school", confirm: "Dhaka2026schoo1" })).toBe("mismatch");
  });
});
