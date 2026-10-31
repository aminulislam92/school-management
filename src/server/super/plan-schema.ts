// Plan rules and constants, with no database access, so both the browser
// (the form) and the server can import them.
import type { BillingCycle } from "@prisma/client";
import { z } from "zod";

/** Modules a plan can switch on. Keys are stored in Plan.features. */
export const PLAN_FEATURES = [
  "attendance",
  "fees",
  "exams",
  "sms",
  "portal",
  "routine",
  "certificates",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const satisfies readonly BillingCycle[];

const money = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .refine((s) => /^\d{1,8}(\.\d{1,2})?$/.test(s), { message: "price" });

export const PlanInput = z.object({
  name: z.string().trim().min(2, { message: "name" }).max(60, { message: "name" }),
  price: money,
  billingCycle: z.enum(BILLING_CYCLES, { message: "billingCycle" }),
  maxStudents: z.coerce.number({ message: "maxStudents" }).int({ message: "maxStudents" }).min(1, { message: "maxStudents" }).max(100_000, { message: "maxStudents" }),
  features: z.array(z.enum(PLAN_FEATURES)).default([]),
  isActive: z.boolean().default(true),
});
export type PlanInput = z.infer<typeof PlanInput>;

/** Field name → error key, for the form. */
export type PlanErrors = Partial<Record<keyof PlanInput | "form", string>>;

/** Read a submitted form into PlanInput (checkboxes → arrays/booleans). */
export function parsePlanForm(formData: FormData) {
  return PlanInput.safeParse({
    name: formData.get("name") ?? "",
    price: formData.get("price") ?? "",
    billingCycle: formData.get("billingCycle") ?? "",
    maxStudents: formData.get("maxStudents") ?? "",
    features: formData.getAll("features").map(String).filter((f) => (PLAN_FEATURES as readonly string[]).includes(f)),
    isActive: formData.get("isActive") === "on",
  });
}

export function planErrors(error: z.ZodError): PlanErrors {
  const out: PlanErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form") as keyof PlanErrors;
    out[field] ??= issue.message;
  }
  return out;
}

