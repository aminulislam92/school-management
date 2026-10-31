"use client";

import { useActionState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateOnly } from "@/lib/dates";
import { addHolidayAction, type HolidayFormState } from "@/server/academic/holiday-actions";

export function HolidayForm() {
  const t = useTranslations("holidays");
  const format = useFormatter();
  const [state, formAction, pending] = useActionState<HolidayFormState, FormData>(addHolidayAction, {});
  const v = state.values ?? {};
  const errors = state.errors ?? {};

  const error = (name: string) => {
    const code = errors[name];
    if (!code) return null;
    const [key, list] = code.split(":"); // "taken:2027-03-30,2027-03-31"
    const dates = (list ?? "")
      .split(",")
      .filter(Boolean)
      .map((d) => format.dateTime(dateOnly(d), { day: "numeric", month: "short", timeZone: "UTC" }))
      .join(", ");
    return (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${key}`, { dates })}
      </p>
    );
  };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div key={state.at ?? 0} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("titleField")}</Label>
          <Input id="title" name="title" defaultValue={v.title ?? ""} placeholder={t("titlePlaceholder")} maxLength={80} aria-invalid={!!errors.title} />
          {error("title")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="from">{t("from")}</Label>
            <Input id="from" type="date" name="from" defaultValue={v.from ?? ""} aria-invalid={!!errors.from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">{t("to")}</Label>
            <Input id="to" type="date" name="to" defaultValue={v.to ?? ""} aria-invalid={!!errors.to} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("toHint")}</p>
        {error("from")}
        {error("to")}
      </div>
      {state.added ? (
        <p id="form-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("added", { days: state.added })}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("add")}
      </Button>
    </form>
  );
}
