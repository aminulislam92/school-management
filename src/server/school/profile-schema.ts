// Rules for the school profile form (/admin/settings/school). No database
// access, so the browser form can import it too.
import { z } from "zod";
import { BD_DIVISIONS, DIVISION_NAMES } from "@/lib/bd-locations";
import { bdPhone, EDUCATION_BOARDS, optional } from "@/server/super/school-schema";

export const SchoolProfileInput = z
  .object({
    nameBn: z.string().trim().min(2, { message: "name" }).max(120, { message: "name" }),
    nameEn: z.string().trim().min(2, { message: "name" }).max(120, { message: "name" }),
    eiin: optional(z.string().regex(/^\d{5,7}$/, { message: "eiin" })),
    board: optional(z.enum(EDUCATION_BOARDS, { message: "board" })),
    phone: optional(bdPhone),
    email: optional(z.email({ message: "email" }).transform((e) => e.toLowerCase())),
    division: optional(z.string().refine((d) => DIVISION_NAMES.includes(d), { message: "division" })),
    district: optional(z.string().max(60, { message: "district" })),
    upazila: optional(z.string().max(60, { message: "upazila" })),
    addressLine: optional(z.string().max(300, { message: "addressLine" })),
  })
  // A district must belong to the chosen division (old free-text districts are allowed without a division).
  .refine(
    (v) => !v.division || !v.district || BD_DIVISIONS.find((d) => d.en === v.division)?.districts.some(([en]) => en === v.district),
    { message: "district", path: ["district"] },
  );

export type SchoolProfileInput = z.infer<typeof SchoolProfileInput>;
export const PROFILE_FIELDS = ["nameBn", "nameEn", "eiin", "board", "phone", "email", "division", "district", "upazila", "addressLine"] as const;

export function parseProfileForm(formData: FormData) {
  return SchoolProfileInput.safeParse(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(formData.get(k) ?? "")])));
}
