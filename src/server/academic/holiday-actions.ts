"use server";

import { revalidatePath } from "next/cache";
import { isYmd } from "@/lib/dates";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import type { RowActionState } from "./class-actions";
import { parseHolidayForm } from "./holiday-schema";
import { addHoliday, deleteHolidayRange } from "./holidays";

const PATH = "/admin/academic/holidays";

export type HolidayFormState = { errors?: Record<string, string>; values?: Record<string, string>; added?: number; at?: number };

async function context() {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  return { user, schoolId: school.id, sdb };
}

export async function addHolidayAction(_prev: HolidayFormState, formData: FormData): Promise<HolidayFormState> {
  const { user, schoolId, sdb } = await context();
  const values = Object.fromEntries(["title", "from", "to"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = parseHolidayForm(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0] ?? "from")] ??= i.message;
    return { errors, values, at: Date.now() };
  }
  const result = await addHoliday(sdb, schoolId, parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };
  revalidatePath(PATH);
  return { added: result.days, at: Date.now() };
}

export async function deleteHolidayAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!isYmd(from) || !isYmd(to)) return { error: "notFound", at: Date.now() };
  const result = await deleteHolidayRange(sdb, schoolId, from, to, String(formData.get("title") ?? ""), user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(PATH);
  return { at: Date.now() };
}
