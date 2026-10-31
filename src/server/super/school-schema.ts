// Rules for the "new school" form. No database access, so the form (browser)
// can import the constants too.
import type { Level } from "@prisma/client";
import { z } from "zod";
import { normalizeBdPhone } from "@/lib/bangla";
import { isValidSchoolCode } from "@/lib/tenant-host";
import { EDUCATION_BOARDS } from "@/server/school-defaults";

export const LEVELS = ["PRE_PRIMARY", "PRIMARY", "SECONDARY", "HIGHER_SECONDARY"] as const satisfies readonly Level[];
export { EDUCATION_BOARDS };

/** Empty text box → undefined; otherwise check it with `schema`. */
const optional = <T extends z.ZodType<unknown, string>>(schema: T) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? undefined : s))
    .pipe(schema.optional());

const bdPhone = z.string().transform((s, ctx) => {
  const phone = normalizeBdPhone(s);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "phone" });
    return z.NEVER;
  }
  return phone;
});

export const NewSchoolInput = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .refine(isValidSchoolCode, { message: "code" }),
    nameBn: z.string().trim().min(2, { message: "name" }).max(120, { message: "name" }),
    nameEn: z.string().trim().min(2, { message: "name" }).max(120, { message: "name" }),
    eiin: optional(z.string().regex(/^\d{5,7}$/, { message: "eiin" })),
    board: optional(z.enum(EDUCATION_BOARDS, { message: "board" })),
    levels: z.array(z.enum(LEVELS)).min(1, { message: "levels" }),
    phone: optional(bdPhone),
    email: optional(z.email({ message: "email" }).transform((e) => e.toLowerCase())),
    district: optional(z.string().max(60)),
    upazila: optional(z.string().max(60)),
    planId: z.coerce.number({ message: "plan" }).int({ message: "plan" }).positive({ message: "plan" }),
    trialDays: z.coerce.number({ message: "trialDays" }).int({ message: "trialDays" }).min(0, { message: "trialDays" }).max(90, { message: "trialDays" }),
    adminNameEn: z.string().trim().min(2, { message: "adminName" }).max(80, { message: "adminName" }),
    adminNameBn: optional(z.string().max(80)),
    adminEmail: optional(z.email({ message: "email" }).transform((e) => e.toLowerCase())),
    adminPhone: optional(bdPhone),
  })
  .refine((v) => v.adminEmail || v.adminPhone, { message: "adminContact", path: ["adminEmail"] });

export type NewSchoolInput = z.infer<typeof NewSchoolInput>;

export type NewSchoolField = keyof z.input<typeof NewSchoolInput> | "form";
export type NewSchoolErrors = Partial<Record<NewSchoolField, string>>;

export function parseNewSchoolForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return NewSchoolInput.safeParse({
    code: get("code"),
    nameBn: get("nameBn"),
    nameEn: get("nameEn"),
    eiin: get("eiin"),
    board: get("board"),
    levels: formData.getAll("levels").map(String).filter((l) => (LEVELS as readonly string[]).includes(l)),
    phone: get("phone"),
    email: get("email"),
    district: get("district"),
    upazila: get("upazila"),
    planId: get("planId"),
    trialDays: get("trialDays"),
    adminNameEn: get("adminNameEn"),
    adminNameBn: get("adminNameBn"),
    adminEmail: get("adminEmail"),
    adminPhone: get("adminPhone"),
  });
}

export function newSchoolErrors(error: z.ZodError): NewSchoolErrors {
  const out: NewSchoolErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form") as NewSchoolField;
    out[field] ??= issue.message;
  }
  return out;
}
