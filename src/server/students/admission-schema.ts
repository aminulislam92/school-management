// Rules for student, guardian and enrollment data (US-3.1, 3.2). No database
// access: the admission form (browser) and the server use the same rules.
// Database checks (birth registration unique in the school, roll unique in the
// section, ids belong to this school) happen in the admission service (T2.3).
import type { BloodGroup, Gender, GuardianRelation, Religion } from "@prisma/client";
import { z } from "zod";
import { normalizeBdPhone, toEnglishDigits } from "@/lib/bangla";
import { isYmd } from "@/lib/dates";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const satisfies readonly Gender[];
export const RELIGIONS = ["ISLAM", "HINDU", "BUDDHIST", "CHRISTIAN", "OTHER"] as const satisfies readonly Religion[];
export const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] as const satisfies readonly BloodGroup[];
export const RELATIONS = ["FATHER", "MOTHER", "OTHER"] as const satisfies readonly GuardianRelation[];
export const MAX_GUARDIANS = 3;

// ── Small cleaners ─────────────────────────────────────────────────────

/** "১২৩৪ ৫৬৭-৮" → "12345678": Bangla digits to English, spaces and dashes removed. */
export const digitsOnly = (s: string) => toEnglishDigits(s).replace(/[\s-]/g, "");

const BANGLA_LETTER = /[ঀ-৿]/;
const ENGLISH_NAME = /^[A-Za-z][A-Za-z .'()-]*$/;

const text = (max: number, message: string) => z.string().trim().max(max, { message });
const optionalText = (max: number, message: string) => text(max, message).transform((s) => s || null);
const ymd = (message: string) => z.string().trim().refine(isYmd, { message });
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.string().transform((v) => (v === "" ? null : v)).pipe(z.enum(values, { message }).nullable());

export const nameBn = z.string().trim().min(2, { message: "nameBn" }).max(100, { message: "nameBn" }).refine((s) => BANGLA_LETTER.test(s), { message: "nameBnScript" });
export const nameEn = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2, { message: "nameEn" }).max(100, { message: "nameEn" }).regex(ENGLISH_NAME, { message: "nameEnScript" }));

/** Birth registration number: exactly 17 digits (Bangla digits are fine). Empty → none. */
export const birthRegNo = z
  .string()
  .transform(digitsOnly)
  .refine((s) => s === "" || /^\d{17}$/.test(s), { message: "birthRegNo" })
  .transform((s) => s || null);

/** National ID: 10 (smart card), 13 or 17 digits. Empty → none. */
export const nid = z
  .string()
  .transform(digitsOnly)
  .refine((s) => s === "" || /^(\d{10}|\d{13}|\d{17})$/.test(s), { message: "nid" })
  .transform((s) => s || null);

export const bdPhone = z.string().transform((s, ctx) => {
  const phone = normalizeBdPhone(s);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "phone" });
    return z.NEVER;
  }
  return phone;
});

// ── Student ────────────────────────────────────────────────────────────

export const StudentInput = z
  .object({
    nameBn,
    nameEn,
    dateOfBirth: ymd("dateOfBirth"),
    gender: z.enum(GENDERS, { message: "gender" }),
    religion: z.enum(RELIGIONS, { message: "religion" }),
    bloodGroup: optionalEnum(BLOOD_GROUPS, "bloodGroup"),
    birthRegNo,
    presentAddress: optionalText(300, "address"),
    permanentAddress: optionalText(300, "address"),
    sameAddress: z.boolean().default(false),
    previousSchool: optionalText(150, "previousSchool"),
    admissionDate: ymd("admissionDate"),
  })
  .refine((s) => s.dateOfBirth < s.admissionDate, { message: "bornAfterAdmission", path: ["dateOfBirth"] })
  // "Same as present address" copies it.
  .transform(({ sameAddress, ...s }) => ({ ...s, permanentAddress: sameAddress ? s.presentAddress : s.permanentAddress }));
export type StudentInput = z.infer<typeof StudentInput>;

// ── Guardians ──────────────────────────────────────────────────────────

export const GuardianInput = z.object({
  relation: z.enum(RELATIONS, { message: "relation" }),
  name: z.string().trim().min(2, { message: "guardianName" }).max(100, { message: "guardianName" }),
  phone: bdPhone,
  nid,
  occupation: optionalText(80, "occupation"),
  isPrimary: z.boolean(),
});
export type GuardianInput = z.infer<typeof GuardianInput>;

// Run the list checks even when a row has its own error (bad phone ...), so the
// form shows "pick a primary guardian" together with the row errors.
const always = { when: () => true };
const rowsOf = (v: unknown) => (Array.isArray(v) ? (v as { isPrimary?: unknown; relation?: unknown; phone?: unknown }[]) : []);

export const GuardiansInput = z
  .array(GuardianInput)
  .min(1, { message: "noGuardian" })
  .max(MAX_GUARDIANS, { message: "tooManyGuardians" })
  // SMS and OTP go to exactly one number.
  .refine((list) => rowsOf(list).filter((g) => g.isPrimary === true).length === 1, { message: "onePrimary", ...always })
  .refine((list) => ["FATHER", "MOTHER"].every((rel) => rowsOf(list).filter((g) => g.relation === rel).length <= 1), { message: "twoParents", ...always })
  .superRefine((list, ctx) => {
    const phones = list.map((g) => g.phone);
    phones.forEach((p, i) => {
      if (phones.indexOf(p) !== i) ctx.addIssue({ code: "custom", message: "samePhone", path: [i, "phone"] });
    });
  });

// ── Enrollment (one session's class/section/roll) ──────────────────────

const id = (message: string) => z.coerce.number({ message }).int({ message }).positive({ message });
const optionalId = (message: string) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
    .transform((v) => (v === "" || v == null ? null : v))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), { message });

export const EnrollmentInput = z
  .object({
    sessionId: id("session"),
    sectionId: id("section"),
    roll: z.preprocess((v) => (typeof v === "string" ? digitsOnly(v) : v), z.coerce.number({ message: "roll" }).int({ message: "roll" }).min(1, { message: "roll" }).max(999, { message: "roll" })),
    groupId: optionalId("group"),
    // Classes 9–12: the elective subjects this student takes, and which of them is the 4th
    // subject. The others count as compulsory (e.g. Biology + Higher Math, one of them 4th).
    electiveSubjectIds: z.array(id("subject")).max(5, { message: "subject" }).default([]),
    optionalSubjectId: optionalId("subject"),
  })
  .refine((e) => e.optionalSubjectId === null || e.electiveSubjectIds.includes(e.optionalSubjectId), { message: "fourthNotTaken", path: ["optionalSubjectId"] })
  .transform((e) => ({ ...e, electiveSubjectIds: [...new Set(e.electiveSubjectIds)] }));
export type EnrollmentInput = z.infer<typeof EnrollmentInput>;

export const AdmissionInput = z.object({ student: StudentInput, guardians: GuardiansInput, enrollment: EnrollmentInput });
export type AdmissionInput = z.infer<typeof AdmissionInput>;

// ── Reading the form ───────────────────────────────────────────────────

const get = (f: FormData, k: string) => String(f.get(k) ?? "");

/**
 * The admission form names its fields like `student.nameBn`, `guardians.0.phone`,
 * `enrollment.roll`, `enrollment.electiveSubjectIds` (repeated). This turns them into
 * the nested object the schema expects. `guardians.N.*` rows with every box empty are skipped.
 */
export function admissionFromForm(f: FormData) {
  const s = (k: string) => get(f, `student.${k}`);
  const guardians = [];
  for (let i = 0; i < MAX_GUARDIANS; i++) {
    const g = (k: string) => get(f, `guardians.${i}.${k}`);
    if (!g("name").trim() && !g("phone").trim()) continue;
    guardians.push({ relation: g("relation"), name: g("name"), phone: g("phone"), nid: g("nid"), occupation: g("occupation"), isPrimary: get(f, "primaryGuardian") === String(i) });
  }
  return {
    student: {
      nameBn: s("nameBn"), nameEn: s("nameEn"), dateOfBirth: s("dateOfBirth"), gender: s("gender"), religion: s("religion"),
      bloodGroup: s("bloodGroup"), birthRegNo: s("birthRegNo"), presentAddress: s("presentAddress"), permanentAddress: s("permanentAddress"),
      sameAddress: f.get("student.sameAddress") === "on", previousSchool: s("previousSchool"), admissionDate: s("admissionDate"),
    },
    guardians,
    enrollment: {
      sessionId: get(f, "enrollment.sessionId"), sectionId: get(f, "enrollment.sectionId"), roll: get(f, "enrollment.roll"),
      groupId: get(f, "enrollment.groupId"), electiveSubjectIds: f.getAll("enrollment.electiveSubjectIds").map(String).filter(Boolean),
      optionalSubjectId: get(f, "enrollment.optionalSubjectId"),
    },
  };
}

export function parseAdmissionForm(f: FormData) {
  return AdmissionInput.safeParse(admissionFromForm(f));
}

/** zod issues → { "student.nameBn": "nameBn", "guardians.0.phone": "phone", "guardians": "onePrimary", ... } */
export function admissionErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".") || "form"] ??= issue.message;
  return out;
}

// ── Warnings (shown, but don't block admission) ────────────────────────

/** Age in whole years on a given day. */
export function ageOn(dateOfBirth: string, day: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Usual age range for a class (order: Play=1 … Twelve=15): Play ≈ 3–4, Class One ≈ 6, Class Ten ≈ 15. */
export function usualAge(classOrder: number) {
  const typical = classOrder + 2; // Play (1) → 3, Class One (4) → 6, Class Ten (13) → 15
  return { min: typical - 2, max: typical + 4 };
}

export type AdmissionWarning = "ageForClass" | "birthRegYear";

export function admissionWarnings(student: { dateOfBirth: string; admissionDate: string; birthRegNo: string | null }, classOrder: number): AdmissionWarning[] {
  const out: AdmissionWarning[] = [];
  const age = ageOn(student.dateOfBirth, student.admissionDate);
  const { min, max } = usualAge(classOrder);
  if (age < min || age > max) out.push("ageForClass");
  // A 17-digit birth registration number starts with the year of birth.
  if (student.birthRegNo && student.birthRegNo.slice(0, 4) !== student.dateOfBirth.slice(0, 4)) out.push("birthRegYear");
  return out;
}
