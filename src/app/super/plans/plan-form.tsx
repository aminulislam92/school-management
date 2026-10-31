"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePlanAction, type PlanFormState, type PlanFormValues } from "@/server/super/plan-actions";
import { BILLING_CYCLES, PLAN_FEATURES } from "@/server/super/plan-schema";

export function PlanForm({ id, initial }: { id: number | null; initial: PlanFormValues }) {
  const t = useTranslations("plans");
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(savePlanAction, {});
  // After a failed save, show what the user typed (React resets the form).
  const v = state.values ?? initial;
  const err = state.errors ?? {};

  const fieldError = (field: keyof typeof err) =>
    err[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {t(`errors.${err[field]}`)}
      </p>
    ) : null;

  return (
    <form action={formAction} className="max-w-xl space-y-5" noValidate>
      {id !== null && <input type="hidden" name="id" value={id} />}

      <div className="space-y-2">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" defaultValue={v.name} aria-invalid={!!err.name} required />
        {fieldError("name")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">{t("fields.price")}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">৳</span>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              className="pl-7"
              defaultValue={v.price}
              aria-invalid={!!err.price}
              required
            />
          </div>
          {fieldError("price")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingCycle">{t("fields.billingCycle")}</Label>
          <select
            id="billingCycle"
            name="billingCycle"
            defaultValue={v.billingCycle}
            aria-invalid={!!err.billingCycle}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>
                {t(`cycles.${c}`)}
              </option>
            ))}
          </select>
          {fieldError("billingCycle")}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxStudents">{t("fields.maxStudents")}</Label>
        <Input
          id="maxStudents"
          name="maxStudents"
          type="number"
          min={1}
          step={1}
          defaultValue={v.maxStudents}
          aria-invalid={!!err.maxStudents}
          className="sm:w-48"
          required
        />
        {fieldError("maxStudents")}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("fields.features")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAN_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="features"
                value={f}
                defaultChecked={v.features.includes(f)}
                className="size-4 accent-primary"
              />
              {t(`features.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={v.isActive} className="size-4 accent-primary" />
        {t("fields.isActive")}
      </label>

      {err.form && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${err.form}`)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        <Link href="/super/plans" className={buttonVariants({ variant: "outline" })}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
