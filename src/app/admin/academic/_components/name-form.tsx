"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NamedFormState } from "@/server/academic/class-actions";

type Values = { nameBn: string; nameEn: string; hasGroups?: boolean };

/**
 * Bangla + English name (and, for Class Nine upward, "has groups").
 * Used for: edit class, new group, edit group.
 */
export function NameForm({
  action,
  id,
  initial,
  showGroups = false,
  cancelHref,
  submitLabel,
}: {
  action: (prev: NamedFormState, formData: FormData) => Promise<NamedFormState>;
  id?: number;
  initial: Values;
  showGroups?: boolean;
  cancelHref?: string;
  submitLabel: string;
}) {
  const t = useTranslations("academicForm");
  const te = useTranslations("academicErrors");
  const [state, formAction, pending] = useActionState(action, {});
  // After an error: what was typed. Otherwise the saved values (or empty for "new").
  const v: Values = state.values ? { ...state.values, hasGroups: state.values.hasGroups === "on" } as Values : initial;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <div key={state.at ?? 0} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nameBn">{t("nameBn")}</Label>
          <Input id="nameBn" name="nameBn" defaultValue={v.nameBn} maxLength={40} aria-invalid={!!state.errors?.nameBn} />
          {state.errors?.nameBn && <p className="text-sm text-destructive">{te("name")}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nameEn">{t("nameEn")}</Label>
          <Input id="nameEn" name="nameEn" defaultValue={v.nameEn} maxLength={40} aria-invalid={!!state.errors?.nameEn} />
          {state.errors?.nameEn && <p className="text-sm text-destructive">{te("name")}</p>}
        </div>
        {showGroups && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="hasGroups" defaultChecked={v.hasGroups} className="mt-0.5 size-4 accent-primary" />
            <span>
              {t("hasGroups")}
              <span className="block text-muted-foreground">{t("hasGroupsHint")}</span>
            </span>
          </label>
        )}
      </div>
      {state.errors?.form && (
        <p id="form-error" role="alert" className="text-sm text-destructive">
          {te(state.errors.form)}
        </p>
      )}
      {state.saved && (
        <p id="form-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : submitLabel}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            {t("cancel")}
          </Link>
        )}
      </div>
    </form>
  );
}
