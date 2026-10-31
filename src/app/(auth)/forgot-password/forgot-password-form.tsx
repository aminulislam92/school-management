"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PasswordInput } from "@/components/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction, type ForgotPasswordState } from "@/server/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const tp = useTranslations("changePassword");
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    { step: "request" },
  );

  const error = state.error && (
    <p id="forgot-error" role="alert" className="text-sm text-destructive">
      {state.error === "required" || state.error === "invalidCode"
        ? t(`errors.${state.error}`)
        : tp(`errors.${state.error}`, { min: MIN_PASSWORD_LENGTH })}
    </p>
  );

  if (state.step === "done") {
    return (
      <div className="space-y-4">
        <p id="forgot-done" role="status">{t("done")}</p>
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  if (state.step === "code") {
    return (
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="step" value="reset" />
        <input type="hidden" name="identifier" value={state.identifier} />
        <p className="text-sm text-muted-foreground">{t("codeSent", { identifier: state.identifier ?? "" })}</p>
        <div className="space-y-2">
          <Label htmlFor="code">{t("code")}</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">{tp("next")}</Label>
          <PasswordInput id="next" name="next" autoComplete="new-password" aria-describedby="password-rules" required />
          <p id="password-rules" className="text-xs text-muted-foreground">
            {tp("rules", { min: MIN_PASSWORD_LENGTH })}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{tp("confirm")}</Label>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
        </div>
        {error}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? tp("saving") : t("setPassword")}
        </Button>
        <Link href="/forgot-password" className="block text-center text-sm text-muted-foreground underline">
          {t("startOver")}
        </Link>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="step" value="request" />
      <div className="space-y-2">
        <Label htmlFor="identifier">{t("identifier")}</Label>
        <Input id="identifier" name="identifier" autoComplete="username" defaultValue={state.identifier} required />
      </div>
      {error}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("sending") : t("sendCode")}
      </Button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground underline">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
