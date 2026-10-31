"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { RowActionState } from "@/server/academic/class-actions";

/** A one-button form (switch on/off, add a level ...) that shows why it was refused. */
export function RowActionButton({
  action,
  fields,
  label,
  variant = "ghost",
}: {
  action: (prev: RowActionState, formData: FormData) => Promise<RowActionState>;
  fields: Record<string, string | number>;
  label: string;
  variant?: "ghost" | "outline" | "default";
}) {
  const t = useTranslations("academicErrors");
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {label}
      </Button>
      {state.error && (
        <span role="alert" className="text-sm text-destructive">
          {t(state.error)}
        </span>
      )}
    </form>
  );
}
