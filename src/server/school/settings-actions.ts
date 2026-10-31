"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getSchoolDb, schoolLocaleTag } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import { parseGeneralSettingsForm, updateGeneralSettings } from "./settings";

export type SettingsValues = {
  defaultLocale: string;
  weeklyHolidays: string[];
  studentLoginFromOrder: number | null;
  studentCanSeeFees: boolean;
  smsOnAbsent: boolean;
  smsOnPayment: boolean;
  smsOnResult: boolean;
};
export type SettingsFormState = { errors?: Record<string, string>; values?: SettingsValues; saved?: boolean; at?: number };

/** What the user submitted, to show it again after an error. */
function submitted(formData: FormData): SettingsValues {
  const order = String(formData.get("studentLoginFromOrder") ?? "");
  return {
    defaultLocale: String(formData.get("defaultLocale") ?? ""),
    weeklyHolidays: formData.getAll("weeklyHolidays").map(String),
    studentLoginFromOrder: order ? Number(order) : null,
    studentCanSeeFees: formData.get("studentCanSeeFees") === "on",
    smsOnAbsent: formData.get("smsOnAbsent") === "on",
    smsOnPayment: formData.get("smsOnPayment") === "on",
    smsOnResult: formData.get("smsOnResult") === "on",
  };
}

export async function updateGeneralSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await assertPermission("settings.manage");
  const { school, sdb } = await getSchoolDb();

  const parsed = parseGeneralSettingsForm(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values: submitted(formData), at: Date.now() };
  }

  const result = await updateGeneralSettings(sdb, school.id, parsed.data, user.id);
  if (!result.ok) return { errors: result.errors, values: submitted(formData), at: Date.now() };

  updateTag(schoolLocaleTag(school.id)); // the cached default language
  revalidatePath("/", "layout");
  return { saved: true, at: Date.now() };
}
