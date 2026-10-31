"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSchool } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import type { ImageKind } from "@/server/storage/images";
import { parseProfileForm, PROFILE_FIELDS } from "./profile-schema";
import { removeSchoolImage, updateSchoolProfile } from "./profile";

export type ProfileFormState = {
  errors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
  saved?: boolean;
  at?: number; // new on every result, so the form re-creates its fields
};

async function currentSchoolId() {
  const school = await getCurrentSchool(); // from the domain, never from the form
  if (!school) throw new Error("No school on this site");
  return school.id;
}

export async function updateSchoolProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await assertPermission("settings.manage");
  const schoolId = await currentSchoolId();

  const parsed = parseProfileForm(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    const values = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
    return { errors, values, at: Date.now() };
  }

  await updateSchoolProfile(schoolId, parsed.data, user.id);
  revalidatePath("/", "layout"); // the school name shows in the menu and login page too
  return { saved: true, at: Date.now() };
}

export async function removeSchoolImageAction(formData: FormData) {
  const user = await assertPermission("settings.manage");
  const kind = formData.get("kind");
  if (kind !== "logo" && kind !== "signature") return;
  await removeSchoolImage(await currentSchoolId(), kind satisfies ImageKind, user.id);
  revalidatePath("/", "layout");
}
