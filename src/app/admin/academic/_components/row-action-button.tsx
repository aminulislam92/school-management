"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { RowActionState } from "@/server/academic/class-actions";

/**
 * A one-button form (switch on/off, add a level, delete ...) that shows why it was refused.
 * With `confirmLabel` it takes two clicks: label → confirmLabel (for deleting).
 */
export function RowActionButton({
  action,
  fields,
  label,
  confirmLabel,
  variant = "ghost",
}: {
  action: (prev: RowActionState, formData: FormData) => Promise<RowActionState>;
  fields: Record<string, string | number>;
  label: string;
  confirmLabel?: string;
  variant?: "ghost" | "outline" | "default";
}) {
  const t = useTranslations("academicErrors");
  const tf = useTranslations("academicForm");
  const [state, formAction, pending] = useActionState(action, {});
  const [asking, setAsking] = useState(false);

  if (confirmLabel && !asking) {
    return (
      <Button type="button" variant={variant} size="sm" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={confirmLabel ? "destructive" : variant} size="sm" disabled={pending}>
        {confirmLabel ?? label}
      </Button>
      {confirmLabel && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
          {tf("cancel")}
        </Button>
      )}
      {state.error && (
        <span role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </span>
      )}
    </form>
  );
}
