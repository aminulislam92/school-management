"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Level } from "@prisma/client";
import { getSchoolDb } from "@/lib/tenant";
import { assertPermission } from "@/server/auth/dal";
import { LEVEL_ORDER, parseClassForm, parseGroupForm } from "./class-schema";
import { addLevel, saveGroup, setClassActive, setGroupActive, updateClass } from "./classes";

export type NamedFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: boolean;
  at?: number; // new on every result, so the form re-creates its fields
};
export type RowActionState = { error?: string; at?: number };

const CLASSES = "/admin/academic/classes";
const GROUPS = "/admin/academic/groups";

const submitted = (formData: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
const zodErrors = (issues: { path: PropertyKey[]; message: string }[]) => {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[String(i.path[0])] ??= i.message;
  return errors;
};

async function context() {
  const user = await assertPermission("academic.manage");
  const { school, sdb } = await getSchoolDb();
  return { user, schoolId: school.id, sdb };
}

export async function updateClassAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = submitted(formData, ["nameBn", "nameEn", "hasGroups"]);
  const parsed = parseClassForm(formData);
  if (!parsed.success) return { errors: zodErrors(parsed.error.issues), values, at: Date.now() };

  const result = await updateClass(sdb, schoolId, Number(formData.get("id")), parsed.data, user.id);
  if (!result.ok) return { errors: { form: result.error }, values, at: Date.now() };
  revalidatePath(CLASSES);
  redirect(CLASSES);
}

export async function setClassActiveAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await setClassActive(sdb, schoolId, Number(formData.get("id")), formData.get("active") === "1", user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(CLASSES);
  return { at: Date.now() };
}

export async function addLevelAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const level = String(formData.get("level")) as Level;
  if (!LEVEL_ORDER.includes(level)) return { error: "levelExists", at: Date.now() };
  const result = await addLevel(sdb, schoolId, level, user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath("/admin/academic", "layout"); // classes, groups and sessions (college) all change
  return { at: Date.now() };
}

export async function saveGroupAction(_prev: NamedFormState, formData: FormData): Promise<NamedFormState> {
  const { user, schoolId, sdb } = await context();
  const values = submitted(formData, ["nameBn", "nameEn"]);
  const parsed = parseGroupForm(formData);
  if (!parsed.success) return { errors: zodErrors(parsed.error.issues), values, at: Date.now() };

  const rawId = formData.get("id");
  const result = await saveGroup(sdb, schoolId, rawId ? Number(rawId) : null, parsed.data, user.id);
  if (!result.ok) return { errors: { form: result.error }, values, at: Date.now() };
  revalidatePath(GROUPS);
  if (rawId) redirect(GROUPS);
  return { saved: true, at: Date.now() };
}

export async function setGroupActiveAction(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const { user, schoolId, sdb } = await context();
  const result = await setGroupActive(sdb, schoolId, Number(formData.get("id")), formData.get("active") === "1", user.id);
  if (!result.ok) return { error: result.error, at: Date.now() };
  revalidatePath(GROUPS);
  return { at: Date.now() };
}
