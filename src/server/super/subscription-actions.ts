"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/dal";
import { fieldErrors, formValues, PaymentInput, SubscriptionInput, type FormErrors } from "./subscription-schema";
import { createSubscription, recordSubscriptionPayment } from "./subscriptions";

// `at` changes on every result, so the form can re-create its fields
// (React resets a form after an action; fresh fields show the right values).
export type SuperFormState = { errors?: FormErrors; values?: Record<string, string>; done?: boolean; at?: number };

function refresh(schoolId: number) {
  revalidatePath(`/super/schools/${schoolId}`);
  revalidatePath("/super/schools");
  revalidatePath("/super/subscriptions");
}

export async function createSubscriptionAction(_prev: SuperFormState, formData: FormData): Promise<SuperFormState> {
  const user = await assertPermission("super.manage");
  const parsed = SubscriptionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData), at: Date.now() };

  const result = await createSubscription(parsed.data, user.id);
  if (!result.ok) return { errors: result.errors, values: formValues(formData), at: Date.now() };

  refresh(parsed.data.schoolId);
  return { done: true, at: Date.now() };
}

export async function recordPaymentAction(_prev: SuperFormState, formData: FormData): Promise<SuperFormState> {
  const user = await assertPermission("super.manage");
  const schoolId = Number(formData.get("schoolId"));
  const parsed = PaymentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !Number.isInteger(schoolId)) {
    return { errors: parsed.success ? { form: "notFound" } : fieldErrors(parsed.error), values: formValues(formData), at: Date.now() };
  }

  const result = await recordSubscriptionPayment(parsed.data, user.id, schoolId);
  if (!result.ok) return { errors: result.errors, values: formValues(formData), at: Date.now() };

  refresh(schoolId);
  return { done: true, at: Date.now() };
}
