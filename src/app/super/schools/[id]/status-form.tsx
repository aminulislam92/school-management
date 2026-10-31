"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { SchoolStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setSchoolStatusAction, type SchoolStatusState } from "@/server/super/school-status-actions";
import { SCHOOL_STATUSES } from "@/server/super/school-schema";

export function StatusForm({ id, current }: { id: number; current: SchoolStatus }) {
  const t = useTranslations("schools");
  const [state, formAction, pending] = useActionState<SchoolStatusState, FormData>(setSchoolStatusAction, {});
  // What the user picked since the last save; null = show the saved status.
  const [picked, setPicked] = useState<{ status: SchoolStatus; after?: number } | null>(null);
  const status = picked && picked.after === state.done ? picked.status : current;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {/* React resets the form after an action; a new key re-creates the radios
          so the checked one matches `status` again. */}
      <fieldset key={`${current}-${state.done ?? 0}`} className="space-y-2">
        <legend className="sr-only">{t("changeStatus")}</legend>
        {SCHOOL_STATUSES.map((s) => (
          <label key={s} className="flex items-start gap-2 rounded-md border p-3 text-sm has-checked:border-primary">
            <input
              type="radio"
              name="status"
              value={s}
              checked={status === s}
              onChange={() => setPicked({ status: s, after: state.done })}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{t(`schoolStatus.${s}`)}</span>
              {s === current && <span className="text-muted-foreground"> ({t("current")})</span>}
              <span className="block text-muted-foreground">{t(`statusHelp.${s}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Textarea
          id="reason"
          name="reason"
          defaultValue={state.error ? state.reason : ""}
          key={state.done ?? "form"}
          placeholder={t("reasonPlaceholder")}
          aria-invalid={state.error === "reason"}
          maxLength={500}
        />
        {state.error && (
          <p id="status-error" className="text-sm text-destructive">
            {t(`statusErrors.${state.error}`)}
          </p>
        )}
        {state.done && !state.error && (
          <p id="status-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("statusSaved")}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending || status === current} variant={status === "ACTIVE" ? "default" : "destructive"}>
        {pending ? t("saving") : t("saveStatus")}
      </Button>
    </form>
  );
}
