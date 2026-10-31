// Rules for the section form. No database access, so the browser form can import it.
// A section = class + name + version + shift (+ group for Classes 9–12) — US-2.3.
import type { Shift, Version } from "@prisma/client";
import { z } from "zod";

export const VERSIONS = ["BANGLA", "ENGLISH"] as const satisfies readonly Version[];
export const SHIFTS = ["MORNING", "DAY"] as const satisfies readonly Shift[];

const id = (message: string) => z.coerce.number({ message }).int({ message }).positive({ message });

/** "ক, খ, গ" → ["ক", "খ", "গ"]: several sections in one go. */
export function splitNames(raw: string): string[] {
  return [...new Set(raw.split(/[,،]/).map((s) => s.trim()).filter(Boolean))];
}

export const SectionInput = z.object({
  classId: id("class"),
  names: z
    .string()
    .transform(splitNames)
    .refine((list) => list.length >= 1 && list.length <= 10, { message: "names" })
    .refine((list) => list.every((n) => n.length <= 20), { message: "names" }),
  version: z.enum(VERSIONS, { message: "version" }),
  shift: z.enum(SHIFTS, { message: "shift" }),
  groupId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), { message: "group" }),
  capacity: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 500), { message: "capacity" }),
});
export type SectionInput = z.infer<typeof SectionInput>;

export const SECTION_FIELDS = ["classId", "names", "version", "shift", "groupId", "capacity"] as const;

export function parseSectionForm(formData: FormData) {
  return SectionInput.safeParse(Object.fromEntries(SECTION_FIELDS.map((k) => [k, String(formData.get(k) ?? "")])));
}
