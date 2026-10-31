// Rules for the subject form. No database access, so the browser form can import it.
//   SINGLE    — one subject, e.g. "গণিত / Mathematics", code 109 (religion subjects say which religion)
//   TWO_PAPER — e.g. "বাংলা / Bangla" with codes 101 + 102: one combined parent (for the
//               result, US-7.3: both papers' marks are added) and its 1st and 2nd paper.
import type { Religion } from "@prisma/client";
import { z } from "zod";

export const RELIGIONS = ["ISLAM", "HINDU", "BUDDHIST", "CHRISTIAN", "OTHER"] as const satisfies readonly Religion[];
export const SUBJECT_KINDS = ["SINGLE", "TWO_PAPER"] as const;

const name = z.string().trim().min(1, { message: "name" }).max(60, { message: "name" });
const code = z.string().trim().toUpperCase().regex(/^[0-9A-Z-]{1,10}$/, { message: "code" });
const religion = z.string().transform((v) => (v === "" ? null : v)).pipe(z.enum(RELIGIONS, { message: "religion" }).nullable());

export const NewSubjectInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SINGLE"), nameBn: name, nameEn: name, code, religion }),
  z
    .object({ kind: z.literal("TWO_PAPER"), nameBn: name, nameEn: name, code1: code, code2: code })
    .refine((v) => v.code1 !== v.code2, { message: "sameCodes", path: ["code2"] }),
]);
export type NewSubjectInput = z.infer<typeof NewSubjectInput>;

/** Editing one subject (a single one, a paper, or a combined parent's name). */
export const EditSubjectInput = z.object({ nameBn: name, nameEn: name, code: code.optional(), religion: religion.optional() });
export type EditSubjectInput = z.infer<typeof EditSubjectInput>;

export const SUBJECT_FIELDS = ["kind", "nameBn", "nameEn", "code", "code1", "code2", "religion"] as const;

const get = (formData: FormData, k: string) => String(formData.get(k) ?? "");

export function parseNewSubjectForm(formData: FormData) {
  return NewSubjectInput.safeParse(Object.fromEntries(SUBJECT_FIELDS.map((k) => [k, get(formData, k)])));
}

export function parseEditSubjectForm(formData: FormData) {
  return EditSubjectInput.safeParse({
    nameBn: get(formData, "nameBn"),
    nameEn: get(formData, "nameEn"),
    code: formData.has("code") ? get(formData, "code") : undefined,
    religion: formData.has("religion") ? get(formData, "religion") : undefined,
  });
}

/** Names of the two papers: "বাংলা" → "বাংলা প্রথম পত্র", "Bangla" → "Bangla 1st Paper". */
export const paperNames = (nameBn: string, nameEn: string) => [
  { nameBn: `${nameBn} প্রথম পত্র`, nameEn: `${nameEn} 1st Paper` },
  { nameBn: `${nameBn} দ্বিতীয় পত্র`, nameEn: `${nameEn} 2nd Paper` },
];

/** The combined parent's code follows its papers: "101+102". */
export const combinedCode = (codes: string[]) => codes.join("+");
