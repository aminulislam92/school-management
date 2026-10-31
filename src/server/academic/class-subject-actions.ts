"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import type { NamedFormState, RowActionState } from "./class-actions";
import { CLASS_SUBJECT_FIELDS, parseClassSubjectForm } from "./class-subject-schema";
import { addClassSubject, copyClassSubjects, removeClassSubject, updateClassSubject } from "./class-subjects";

const PATH = "/admin/academic/class-subjects";

async function context() {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  return { user, schoolId: school.id, sdb };
}

const valuesOf = (formData: FormData) => Object.fromEntries(CLASS_SUBJECT_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
const errorsOf = (issues: { path: PropertyKey[]; message: string }[]) => {
  const errors: Record<string, string> = {};
  for (const i of issues) {
    const field = String(i.path[0]);
    errors[/Full|Pass/.test(field) ? "marks" : field] ??= i.message;
  }
  return errors;
};

export async function addClassSubjectAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = valuesOf(formData);
  const parsed = parseClassSubjectForm(formData);
  if (!parsed.success) return { errors: errorsOf(parsed.error.issues), values, at: Date.now() };

  const result = await addClassSubject(sdb, schoolId, parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };
  revalidatePath(PATH);
  // Keep group, type and marks for the next subject; clear the subject and order.
  return { saved: true, values: { ...values, subjectId: "", sortOrder: "" }, at: Date.now() };
}

export async function updateClassSubjectAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = valuesOf(formData);
  const parsed = parseClassSubjectForm(formData);
  if (!parsed.success) return { errors: errorsOf(parsed.error.issues), values, at: Date.now() };

  const result = await updateClassSubject(sdb, schoolId, Number(formData.get("id")), parsed.data, user.id);
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.error }, values, at: Date.now() };
  revalidatePath(PATH);
  redirect(`${PATH}?class=${parsed.data.classId}`);
}

export async function removeClassSubjectAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await removeClassSubject(sdb, schoolId, Number(formData.get("id")), user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(PATH);
  return { at: Date.now() };
}

export type CopyState = { error?: string; copied?: number; at?: number };

export async function copyClassSubjectsAction(_prev: CopyState, formData: FormData): Promise<CopyState> {
  const { user, schoolId, sdb } = await context();
  const result = await copyClassSubjects(sdb, schoolId, Number(formData.get("fromClassId")), Number(formData.get("toClassId")), user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(PATH);
  return { copied: result.count, at: Date.now() };
}
