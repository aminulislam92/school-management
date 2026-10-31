"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { updateGeneralSettingsAction, type SettingsFormState, type SettingsValues } from "@/server/school/settings-actions";
import { WEEK_DAYS } from "@/server/school/settings-schema";

type Initial = SettingsValues;

const selectClass =
  "h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function GeneralSettingsForm({ initial: saved, classes }: { initial: Initial; classes: { order: number; name: string }[] }) {
  const t = useTranslations("generalSettings");
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(updateGeneralSettingsAction, {});
  const err = state.errors ?? {};
  // After an error: what the user ticked. Otherwise: what is saved (fresh from the server).
  const initial = state.values ?? saved;
  const error = (name: string) =>
    err[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${err[name]}`)}
      </p>
    ) : null;

  // Only uncontrolled fields (defaultValue/defaultChecked): React resets the form
  // after the action, and the new key (state.at) re-creates them from `initial`.
  const toggle = (name: keyof Initial, label: string, hint?: string) => (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={initial[name] as boolean} className="mt-0.5 size-4 accent-primary" />
      <span>
        {label}
        {hint && <span className="block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div key={state.at ?? 0} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("languageTitle")}</CardTitle>
            <CardDescription>{t("languageHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="defaultLocale" className="sr-only">
              {t("languageTitle")}
            </Label>
            <select id="defaultLocale" name="defaultLocale" defaultValue={initial.defaultLocale} className={selectClass}>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("holidaysTitle")}</CardTitle>
            <CardDescription>{t("holidaysHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <fieldset className="flex flex-wrap gap-2" aria-describedby={err.weeklyHolidays ? "weeklyHolidays-error" : undefined}>
              <legend className="sr-only">{t("holidaysTitle")}</legend>
              {WEEK_DAYS.map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5">
                  <input type="checkbox" name="weeklyHolidays" value={d} defaultChecked={initial.weeklyHolidays.includes(d)} className="size-4 accent-primary" />
                  {t(`days.${d}`)}
                </label>
              ))}
            </fieldset>
            {error("weeklyHolidays")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("studentTitle")}</CardTitle>
            <CardDescription>{t("studentHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentLoginFromOrder">{t("studentLoginFrom")}</Label>
              <select
                id="studentLoginFromOrder"
                name="studentLoginFromOrder"
                defaultValue={initial.studentLoginFromOrder ?? ""}
                className={selectClass}
                aria-invalid={!!err.studentLoginFromOrder}
              >
                <option value="">{t("studentLoginOff")}</option>
                {classes.map((c) => (
                  <option key={c.order} value={c.order}>
                    {t("fromClass", { name: c.name })}
                  </option>
                ))}
              </select>
              {error("studentLoginFromOrder")}
            </div>
            {toggle("studentCanSeeFees", t("studentCanSeeFees"), t("studentCanSeeFeesHint"))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("smsTitle")}</CardTitle>
            <CardDescription>{t("smsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {toggle("smsOnAbsent", t("smsOnAbsent"))}
            {toggle("smsOnPayment", t("smsOnPayment"))}
            {toggle("smsOnResult", t("smsOnResult"))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        {state.saved && (
          <p id="settings-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
