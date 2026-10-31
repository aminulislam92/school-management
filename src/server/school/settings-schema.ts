// Rules for the general settings form (/admin/settings/general). No database
// access, so the browser form can import the constants too.
import { z } from "zod";
import { locales } from "@/i18n/config";

/** The Bangladeshi week starts on Saturday. */
export const WEEK_DAYS = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

const checkbox = z.string().transform((v) => v === "on");

export const GeneralSettingsInput = z.object({
  defaultLocale: z.enum(locales, { message: "locale" }),
  // Up to 3 days off a week (most schools: Friday, or Friday + Saturday).
  weeklyHolidays: z.array(z.enum(WEEK_DAYS)).max(3, { message: "holidays" }),
  studentLoginFromOrder: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 99), { message: "studentLogin" }),
  studentCanSeeFees: checkbox,
  smsOnAbsent: checkbox,
  smsOnPayment: checkbox,
  smsOnResult: checkbox,
});
export type GeneralSettingsInput = z.infer<typeof GeneralSettingsInput>;

export const SETTING_TOGGLES = ["studentCanSeeFees", "smsOnAbsent", "smsOnPayment", "smsOnResult"] as const;

const dayIndex = (d: string) => (WEEK_DAYS as readonly string[]).indexOf(d);

export function parseGeneralSettingsForm(formData: FormData) {
  const days = formData.getAll("weeklyHolidays").map(String);
  return GeneralSettingsInput.safeParse({
    defaultLocale: String(formData.get("defaultLocale") ?? ""),
    // No duplicates, in week order (Sat → Fri). Unknown values stay in, so zod rejects them.
    weeklyHolidays: [...new Set(days)].sort((a, b) => dayIndex(a) - dayIndex(b)),
    studentLoginFromOrder: String(formData.get("studentLoginFromOrder") ?? ""),
    ...Object.fromEntries(SETTING_TOGGLES.map((k) => [k, String(formData.get(k) ?? "")])),
  });
}
