"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import { parseSessionForm } from "./session-schema";
import { createSession, deleteSession, setCurrentSession, updateSession } from "./sessions";

export type SessionFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: boolean;
  at?: number; // new on every result, so the form re-creates its fields
};

const PATH = "/admin/academic/sessions";

function submitted(formData: FormData) {
  return Object.fromEntries(["type", "name", "startDate", "endDate"].map((k) => [k, String(formData.get(k) ?? "")]));
}

async function schoolLevels(schoolId: number): Promise<string[]> {
  // `School` is the school itself (global table); its id comes from the domain.
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { levels: true } });
  return school.levels as string[];
}

/** One action for both "new" (no id) and "edit" (id). */
export async function saveSessionAction(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();

  const parsed = parseSessionForm(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values: submitted(formData), at: Date.now() };
  }

  const rawId = formData.get("id");
  const levels = await schoolLevels(school.id);
  const result = rawId
    ? await updateSession(sdb, school.id, Number(rawId), parsed.data, levels, user.id)
    : await createSession(sdb, school.id, parsed.data, levels, user.id);
  if (!result.ok) return { errors: result.errors, values: submitted(formData), at: Date.now() };

  revalidatePath(PATH);
  if (rawId) redirect(PATH); // edit page → back to the list
  return { saved: true, at: Date.now() };
}

export async function setCurrentSessionAction(formData: FormData) {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  await setCurrentSession(sdb, school.id, Number(formData.get("id")), user.id);
  revalidatePath("/admin", "layout"); // the current session shows in several places
}

export type DeleteState = { error?: string; at?: number };

export async function deleteSessionAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  const result = await deleteSession(sdb, school.id, Number(formData.get("id")), user.id);
  if (!result.ok) return { error: result.errors.form, at: Date.now() };
  revalidatePath(PATH);
  return { at: Date.now() };
}
