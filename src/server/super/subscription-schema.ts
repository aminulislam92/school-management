// Rules for the subscription and payment forms (super admin). No database
// access, so the browser forms can import the constants too.
import type { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { isYmd } from "@/lib/dates";

export const NEW_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIAL"] as const;
export const PAYMENT_METHODS = ["BKASH", "NAGAD", "ROCKET", "BANK", "CASH", "OTHER"] as const satisfies readonly PaymentMethod[];
/** Mobile banking and bank payments need a transaction ID, so they can be checked later. */
export const NEEDS_TRX_ID: readonly PaymentMethod[] = ["BKASH", "NAGAD", "ROCKET", "BANK"];

const ymd = (message: string) => z.string().trim().refine(isYmd, { message });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "note" })
    .transform((s) => s || undefined);

export const SubscriptionInput = z
  .object({
    schoolId: z.coerce.number().int().positive(),
    planId: z.coerce.number({ message: "plan" }).int({ message: "plan" }).positive({ message: "plan" }),
    status: z.enum(NEW_SUBSCRIPTION_STATUSES, { message: "status" }),
    startsOn: ymd("date"),
    endsOn: ymd("date"),
    note: optionalText(500),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "endBeforeStart", path: ["endsOn"] }); // "YYYY-MM-DD" sorts as text

export type SubscriptionInput = z.infer<typeof SubscriptionInput>;

export const PaymentInput = z
  .object({
    subscriptionId: z.coerce.number({ message: "subscription" }).int().positive({ message: "subscription" }),
    amount: z
      .string()
      .trim()
      .transform((s) => s.replace(/,/g, ""))
      .refine((s) => /^\d{1,8}(\.\d{1,2})?$/.test(s) && Number(s) > 0, { message: "amount" }),
    method: z.enum(PAYMENT_METHODS, { message: "method" }),
    trxId: z
      .string()
      .trim()
      .max(60, { message: "trxId" })
      .transform((s) => s.toUpperCase() || undefined),
    paidOn: ymd("date"),
    note: optionalText(200),
  })
  .refine((v) => v.trxId || !NEEDS_TRX_ID.includes(v.method), { message: "trxIdRequired", path: ["trxId"] });

export type PaymentInput = z.infer<typeof PaymentInput>;

export type FormErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FormErrors {
  const out: FormErrors = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

/** Form fields as plain strings, to refill the form after a failed save. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (!k.startsWith("$") && typeof v === "string") out[k] = v;
  return out;
}
