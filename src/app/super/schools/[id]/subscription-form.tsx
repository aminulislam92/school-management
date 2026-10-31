"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { periodEnd } from "@/lib/dates";
import { createSubscriptionAction, type SuperFormState } from "@/server/super/subscription-actions";
import { NEW_SUBSCRIPTION_STATUSES } from "@/server/super/subscription-schema";

export type PlanChoice = { id: number; label: string; cycle: "MONTHLY" | "YEARLY" };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SubscriptionForm(props: { schoolId: number; plans: PlanChoice[]; startsOn: string; planId: number | null }) {
  const t = useTranslations("subs");
  const [state, formAction, pending] = useActionState<SuperFormState, FormData>(createSubscriptionAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="schoolId" value={props.schoolId} />
      <Fields key={state.at ?? 0} {...props} state={state} />
      {state.errors?.form && <p className="text-sm text-destructive">{t(`errors.${state.errors.form}`)}</p>}
      {state.done && (
        <p id="sub-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("subSaved")}
        </p>
      )}
      <Button type="submit" disabled={pending || props.plans.length === 0}>
        {pending ? t("saving") : t("createSub")}
      </Button>
    </form>
  );
}

function Fields({
  plans,
  startsOn: suggestedStart,
  planId: suggestedPlan,
  state,
}: { plans: PlanChoice[]; startsOn: string; planId: number | null; state: SuperFormState }) {
  const t = useTranslations("subs");
  const v = state.values;
  const err = state.errors ?? {};
  const firstPlan = plans.find((p) => p.id === suggestedPlan) ?? plans[0];

  const [planId, setPlanId] = useState(v?.planId ?? String(firstPlan?.id ?? ""));
  const [startsOn, setStartsOn] = useState(v?.startsOn ?? suggestedStart);
  // The end date follows the plan and start date until the user types their own.
  const [customEnd, setCustomEnd] = useState<string | null>(v?.endsOn ?? null);
  const cycle = plans.find((p) => String(p.id) === planId)?.cycle ?? "MONTHLY";
  const endsOn = customEnd ?? (startsOn ? periodEnd(startsOn, cycle) : "");

  const error = (name: string) =>
    err[name] ? (
      <p id={`sub-${name}-error`} className="text-sm text-destructive">
        {t(`errors.${err[name]}`)}
      </p>
    ) : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="sub-plan">{t("plan")}</Label>
        <select
          id="sub-plan"
          name="planId"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setCustomEnd(null);
          }}
          className={selectClass}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {error("planId")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-status">{t("kind")}</Label>
        <select id="sub-status" name="status" defaultValue={v?.status ?? "ACTIVE"} className={selectClass}>
          {NEW_SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`kinds.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-start">{t("startsOn")}</Label>
        <Input
          id="sub-start"
          type="date"
          name="startsOn"
          value={startsOn}
          onChange={(e) => {
            setStartsOn(e.target.value);
            setCustomEnd(null);
          }}
          aria-invalid={!!err.startsOn}
        />
        {error("startsOn")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-end">{t("endsOn")}</Label>
        <Input id="sub-end" type="date" name="endsOn" value={endsOn} onChange={(e) => setCustomEnd(e.target.value)} aria-invalid={!!err.endsOn} />
        {error("endsOn")}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sub-note">{t("note")}</Label>
        <Textarea id="sub-note" name="note" defaultValue={v?.note ?? ""} maxLength={500} placeholder={t("subNotePlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("overlapHint")}</p>
      </div>
    </div>
  );
}
