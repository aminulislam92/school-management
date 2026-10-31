"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import type { NamedFormState, RowActionState } from "./class-actions";
import { parseSectionForm, SECTION_FIELDS } from "./section-schema";
import { createSections, deleteSection, setSectionActive, updateSection } from "./sections";

const PATH = "/admin/academic/sections";

async function context() {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  return { user, schoolId: school.id, sdb };
}

/** New (no id; "ক, খ, গ" makes three) or edit (id). */
export async function saveSectionAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = Object.fromEntries(SECTION_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = parseSectionForm(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values, at: Date.now() };
  }

  const rawId = formData.get("id");
  const result = rawId
    ? await updateSection(sdb, schoolId, Number(rawId), parsed.data, user.id)
    : await createSections(sdb, schoolId, parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };

  revalidatePath("/admin/academic", "layout"); // section counts show on the classes and groups pages too
  if (rawId) redirect(PATH);
  // Keep class/version/shift/group for the next entry; clear only the names.
  return { saved: true, values: { ...values, names: "" }, at: Date.now() };
}

export async function setSectionActiveAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await setSectionActive(sdb, schoolId, Number(formData.get("id")), formData.get("active") === "1", user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath("/admin/academic", "layout");
  return { at: Date.now() };
}

export async function deleteSectionAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await deleteSection(sdb, schoolId, Number(formData.get("id")), user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath("/admin/academic", "layout");
  return { at: Date.now() };
}
