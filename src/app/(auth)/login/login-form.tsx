"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/server/auth/actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">{t("identifier")}</Label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          defaultValue={state.identifier}
          placeholder={t("identifierPlaceholder")}
          required
          aria-invalid={!!state.error}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error}
        />
      </div>

      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`, { minutes: state.minutes ?? 0 })}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
