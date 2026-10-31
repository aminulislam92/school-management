import { describe, expect, it } from "vitest";
import { BD_DIVISIONS, divisionOf } from "./bd-locations";

describe("bd-locations", () => {
  it("has 8 divisions and 64 different districts", () => {
    expect(BD_DIVISIONS).toHaveLength(8);
    const districts = BD_DIVISIONS.flatMap((d) => d.districts.map(([en]) => en));
    expect(districts).toHaveLength(64);
    expect(new Set(districts).size).toBe(64);
  });
  it("finds a district's division", () => {
    expect(divisionOf("Gazipur")).toBe("Dhaka");
    expect(divisionOf("Cox's Bazar")).toBe("Chattogram");
    expect(divisionOf("Atlantis")).toBeUndefined();
  });
});
