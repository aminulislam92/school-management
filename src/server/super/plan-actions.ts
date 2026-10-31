"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/server/auth/dal";
import { parsePlanForm, planErrors, type PlanErrors } from "./plan-schema";
import { savePlan, setPlanActive } from "./plans";

export type PlanFormValues = {
  name: string;
  price: string;
  billingCycle: string;
  maxStudents: string;
  features: string[];
  isActive: boolean;
};

export type PlanFormState = { errors?: PlanErrors; values?: PlanFormValues };

function submittedValues(formData: FormData): PlanFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    price: String(formData.get("price") ?? ""),
    billingCycle: String(formData.get("billingCycle") ?? ""),
    maxStudents: String(formData.get("maxStudents") ?? ""),
    features: formData.getAll("features").map(String),
    isActive: formData.get("isActive") === "on",
  };
}

export async function savePlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const user = await assertPermission("super.manage");
  const rawId = formData.get("id");
  const id = rawId ? Number(rawId) : null;
  if (id !== null && !Number.isInteger(id)) return { errors: { form: "notFound" } };

  const parsed = parsePlanForm(formData);
  if (!parsed.success) return { errors: planErrors(parsed.error), values: submittedValues(formData) };

  const result = await savePlan(id, parsed.data, user.id);
  if (!result.ok) return { errors: result.errors, values: submittedValues(formData) };

  redirect("/super/plans");
}

export async function togglePlanAction(formData: FormData) {
  const user = await assertPermission("super.manage");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await setPlanActive(id, formData.get("active") === "1", user.id);
  revalidatePath("/super/plans");
}
