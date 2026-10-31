import { describe, expect, it } from "vitest";
import { CHILD_MODELS, modelKind, scopeWhere, SCHOOL_MODELS, unclassifiedModels } from "./tenant-scope";

describe("tenant-scope", () => {
  it("every table in schema.prisma is classified", () => {
    // If this fails after adding a model: add it to CHILD_MODELS or GLOBAL_MODELS,
    // or give it a schoolId column.
    expect(unclassifiedModels()).toEqual([]);
  });

  it("finds the tables that have schoolId", () => {
    expect(SCHOOL_MODELS.has("Student")).toBe(true);
    expect(SCHOOL_MODELS.has("Invoice")).toBe(true);
    expect(SCHOOL_MODELS.has("School")).toBe(false);
    expect(SCHOOL_MODELS.has("InvoiceLine")).toBe(false);
  });

  it("child tables point at a parent that has schoolId", () => {
    for (const [model, link] of Object.entries(CHILD_MODELS)) {
      expect(SCHOOL_MODELS.has(link!.parent), `${model} → ${link!.parent}`).toBe(true);
    }
  });

  it("builds the right where condition", () => {
    expect(scopeWhere("Student", 7)).toEqual({ schoolId: 7 });
    expect(scopeWhere("InvoiceLine", 7)).toEqual({ invoice: { schoolId: 7 } });
    expect(scopeWhere("School", 7)).toEqual({ id: 7 });
    expect(scopeWhere("Plan", 7)).toEqual({});
    expect(modelKind("Nope")).toBeNull();
  });
});
