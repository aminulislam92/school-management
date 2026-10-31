"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { deleteSessionAction, type DeleteState } from "@/server/academic/session-actions";

/** Two clicks: "মুছুন" → "নিশ্চিত, মুছুন". Only shown for an unused, non-current session. */
export function DeleteSessionButton({ id }: { id: number }) {
  const t = useTranslations("sessions");
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(deleteSessionAction, {});
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(true)}>
        {t("delete")}
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {t("confirmDelete")}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
        {t("cancel")}
      </Button>
      {state.error && <span className="text-sm text-destructive">{t(`errors.${state.error}`)}</span>}
    </form>
  );
}
