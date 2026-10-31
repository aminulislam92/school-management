// Rules for the holiday form. No database access, so the browser form can import it.
import { z } from "zod";
import { addDays, isYmd } from "@/lib/dates";

export const MAX_HOLIDAY_DAYS = 60;

export const HolidayInput = z
  .object({
    title: z.string().trim().min(2, { message: "title" }).max(80, { message: "title" }),
    from: z.string().trim().refine(isYmd, { message: "date" }),
    // Empty "to" → a one-day holiday.
    to: z.string().trim().refine((v) => v === "" || isYmd(v), { message: "date" }),
  })
  .transform((v) => ({ ...v, to: v.to || v.from }))
  .refine((v) => v.to >= v.from, { message: "toBeforeFrom", path: ["to"] })
  .refine((v) => !isYmd(v.from) || v.to <= addDays(v.from, MAX_HOLIDAY_DAYS - 1), { message: "tooLong", path: ["to"] });
export type HolidayInput = z.infer<typeof HolidayInput>;

export function parseHolidayForm(formData: FormData) {
  return HolidayInput.safeParse({ title: String(formData.get("title") ?? ""), from: String(formData.get("from") ?? ""), to: String(formData.get("to") ?? "") });
}
