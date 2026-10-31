// Rules for the class-subject form. No database access, so the browser form can import it.
import type { SubjectType } from "@prisma/client";
import { z } from "zod";

export const SUBJECT_TYPES = ["COMPULSORY", "OPTIONAL", "RELIGION"] as const satisfies readonly SubjectType[];

const intOrNull = (message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 200), { message });
const full = (message: string) => intOrNull(message).transform((v) => v ?? 0);

export const ClassSubjectInput = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number({ message: "subject" }).int().positive({ message: "subject" }),
  groupId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), { message: "group" }),
  type: z.enum(SUBJECT_TYPES, { message: "type" }),
  writtenFull: full("marks"),
  writtenPass: intOrNull("marks"), // empty → 33%
  mcqFull: full("marks"),
  mcqPass: intOrNull("marks"),
  practicalFull: full("marks"),
  practicalPass: intOrNull("marks"),
  sortOrder: intOrNull("sortOrder"),
});
export type ClassSubjectInput = z.infer<typeof ClassSubjectInput>;

export const CLASS_SUBJECT_FIELDS = [
  "classId", "subjectId", "groupId", "type",
  "writtenFull", "writtenPass", "mcqFull", "mcqPass", "practicalFull", "practicalPass", "sortOrder",
] as const;

export function parseClassSubjectForm(formData: FormData) {
  return ClassSubjectInput.safeParse(Object.fromEntries(CLASS_SUBJECT_FIELDS.map((k) => [k, String(formData.get(k) ?? "")])));
}
