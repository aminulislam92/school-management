// Which tables belong to a school, and how to tell. Pure data + helpers,
// no database access, so it can be unit-tested.
import { Prisma } from "@prisma/client";

export type ModelName = Prisma.ModelName;

/** Tables that are not owned by any one school. */
export const GLOBAL_MODELS = new Set<ModelName>(["Plan", "School"]);

/**
 * Tables without their own schoolId. They belong to a school through a parent
 * row that has one, e.g. an InvoiceLine belongs to its Invoice.
 * `relation` is the Prisma relation field, `fk` the foreign-key column.
 */
export const CHILD_MODELS: Partial<
  Record<ModelName, { relation: string; fk: string; parent: ModelName }>
> = {
  UserRole: { relation: "user", fk: "userId", parent: "User" },
  ClassSubject: { relation: "class", fk: "classId", parent: "SchoolClass" },
  StudentGuardian: { relation: "student", fk: "studentId", parent: "Student" },
  ClassTeacherAssignment: { relation: "section", fk: "sectionId", parent: "Section" },
  TeacherSubjectAssignment: { relation: "section", fk: "sectionId", parent: "Section" },
  InvoiceLine: { relation: "invoice", fk: "invoiceId", parent: "Invoice" },
  PaymentAllocation: { relation: "payment", fk: "paymentId", parent: "Payment" },
  GradeScaleItem: { relation: "gradeScale", fk: "gradeScaleId", parent: "GradeScale" },
  ExamClass: { relation: "exam", fk: "examId", parent: "Exam" },
  ExamSubject: { relation: "exam", fk: "examId", parent: "Exam" },
  ResultConfigWeight: { relation: "resultConfig", fk: "resultConfigId", parent: "ResultConfig" },
};

/** Tables with a schoolId column, read from the Prisma schema itself. */
export const SCHOOL_MODELS = new Set<ModelName>(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "schoolId"))
    .map((m) => m.name as ModelName),
);

export type ModelKind = "school" | "child" | "global";

export function modelKind(model: string): ModelKind | null {
  const name = model as ModelName;
  if (SCHOOL_MODELS.has(name)) return "school";
  if (CHILD_MODELS[name]) return "child";
  if (GLOBAL_MODELS.has(name)) return "global";
  return null;
}

/** Models in the schema that nobody has classified yet (should be empty). */
export function unclassifiedModels(): string[] {
  return Prisma.dmmf.datamodel.models.map((m) => m.name).filter((n) => modelKind(n) === null);
}

/** The `where` condition that limits a model to one school. */
export function scopeWhere(model: string, schoolId: number): Record<string, unknown> {
  const name = model as ModelName;
  if (SCHOOL_MODELS.has(name)) return { schoolId };
  const child = CHILD_MODELS[name];
  if (child) return { [child.relation]: { schoolId } };
  if (name === "School") return { id: schoolId };
  return {}; // Plan: readable by everyone
}

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(`[tenant] ${message}`);
    this.name = "TenantViolationError";
  }
}
