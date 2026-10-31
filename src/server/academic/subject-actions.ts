"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import type { NamedFormState, RowActionState } from "./class-actions";
import { parseEditSubjectForm, parseNewSubjectForm, SUBJECT_FIELDS } from "./subject-schema";
import { createSubject, deleteSubject, setSubjectActive, updateSubject } from "./subjects";

const PATH = "/admin/academic/subjects";

async function context() {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  return { user, schoolId: school.id, sdb };
}

const errorsOf = (issues: { path: PropertyKey[]; message: string }[]) => {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return errors;
};

export async function createSubjectAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = Object.fromEntries(SUBJECT_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = parseNewSubjectForm(formData);
  if (!parsed.success) return { errors: errorsOf(parsed.error.issues), values, at: Date.now() };

  const result = await createSubject(sdb, schoolId, parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };
  revalidatePath(PATH);
  // Keep the kind for the next entry; clear the rest.
  return { saved: true, values: { kind: values.kind }, at: Date.now() };
}

export async function updateSubjectAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = Object.fromEntries(["nameBn", "nameEn", "code", "religion"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = parseEditSubjectForm(formData);
  if (!parsed.success) return { errors: errorsOf(parsed.error.issues), values, at: Date.now() };

  const result = await updateSubject(sdb, schoolId, Number(formData.get("id")), parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };
  revalidatePath(PATH);
  redirect(PATH);
}

export async function setSubjectActiveAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await setSubjectActive(sdb, schoolId, Number(formData.get("id")), formData.get("active") === "1", user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(PATH);
  return { at: Date.now() };
}

export async function deleteSubjectAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await deleteSubject(sdb, schoolId, Number(formData.get("id")), user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(PATH);
  return { at: Date.now() };
}
