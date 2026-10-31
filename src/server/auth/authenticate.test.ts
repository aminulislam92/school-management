import { describe, expect, it } from "vitest";
import { parseIdentifier } from "./authenticate";

describe("parseIdentifier", () => {
  it.each([
    ["Admin@Demo.School", { field: "email", value: "admin@demo.school" }],
    ["01712345678", { field: "phone", value: "01712345678" }],
    ["+880 1712-345678", { field: "phone", value: "01712345678" }],
    ["০১৭১২৩৪৫৬৭৮", { field: "phone", value: "01712345678" }],
    ["2026-0001", { field: "username", value: "2026-0001" }],
    ["২০২৬-০০০১", { field: "username", value: "2026-0001" }],
    ["  2026-0001  ", { field: "username", value: "2026-0001" }],
  ])("%s", (raw, expected) => {
    expect(parseIdentifier(raw)).toEqual(expected);
  });

  it("empty input is null", () => {
    expect(parseIdentifier("   ")).toBeNull();
  });
});
