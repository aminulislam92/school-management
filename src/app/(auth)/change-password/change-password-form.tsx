"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordState } from "@/server/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password-policy";

export function ChangePasswordForm({ cancelHref }: { cancelHref: string | null }) {
  const t = useTranslations("changePassword");
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="current">{t("current")}</Label>
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">{t("next")}</Label>
        <PasswordInput
          id="next"
          name="next"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby="password-rules"
          required
        />
        <p id="password-rules" className="text-xs text-muted-foreground">
          {t("rules", { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">{t("confirm")}</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </div>

      {state.error && (
        <p id="change-password-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`, { min: MIN_PASSWORD_LENGTH })}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? t("saving") : t("save")}
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
