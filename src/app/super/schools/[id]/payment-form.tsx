"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPaymentAction, type SuperFormState } from "@/server/super/subscription-actions";
import { PAYMENT_METHODS } from "@/server/super/subscription-schema";

export type SubscriptionChoice = { id: number; label: string; price: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PaymentForm({ schoolId, subscriptions, today }: { schoolId: number; subscriptions: SubscriptionChoice[]; today: string }) {
  const t = useTranslations("subs");
  const [state, formAction, pending] = useActionState<SuperFormState, FormData>(recordPaymentAction, {});
  const v = state.values;
  const err = state.errors ?? {};
  const error = (name: string) =>
    err[name] ? (
      <p id={`pay-${name}-error`} className="text-sm text-destructive">
        {t(`errors.${err[name]}`)}
      </p>
    ) : null;

  if (subscriptions.length === 0) return <p className="text-sm text-muted-foreground">{t("noSubForPayment")}</p>;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="schoolId" value={schoolId} />
      {/* New key after every save/error: fresh fields with the right default values. */}
      <div key={state.at ?? 0} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pay-sub">{t("forSubscription")}</Label>
          <select id="pay-sub" name="subscriptionId" defaultValue={v?.subscriptionId ?? String(subscriptions[0].id)} className={selectClass}>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {error("subscriptionId")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-amount">{t("amount")}</Label>
          <Input id="pay-amount" name="amount" inputMode="decimal" defaultValue={v?.amount ?? subscriptions[0].price} aria-invalid={!!err.amount} />
          {error("amount")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-date">{t("paidOn")}</Label>
          <Input id="pay-date" type="date" name="paidOn" max={today} defaultValue={v?.paidOn ?? today} aria-invalid={!!err.paidOn} />
          {error("paidOn")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-method">{t("method")}</Label>
          <select id="pay-method" name="method" defaultValue={v?.method ?? "BKASH"} className={selectClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`methods.${m}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-trx">{t("trxId")}</Label>
          <Input id="pay-trx" name="trxId" defaultValue={v?.trxId ?? ""} autoCapitalize="characters" spellCheck={false} aria-invalid={!!err.trxId} />
          {error("trxId")}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pay-note">{t("note")}</Label>
          <Input id="pay-note" name="note" defaultValue={v?.note ?? ""} maxLength={200} />
        </div>
      </div>
      {error("form")}
      {state.done && (
        <p id="pay-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("paySaved")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("recordPayment")}
      </Button>
    </form>
  );
}
