"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SessionType } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSessionAction, type SessionFormState } from "@/server/academic/session-actions";
import { suggestSession } from "@/server/academic/session-schema";

type Values = { type: string; name: string; startDate: string; endDate: string };
type Suggest = { lastSchoolEnd: string | null; lastCollegeEnd: string | null; year: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** New session (with `suggest`) or edit (with `id` + `initial`). */
export function SessionForm(props: { types: readonly SessionType[]; suggest?: Suggest; id?: number; initial?: Values }) {
  const t = useTranslations("sessions");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(saveSessionAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {props.id && <input type="hidden" name="id" value={props.id} />}
      <Fields key={state.at ?? 0} {...props} values={state.values as Values | undefined} errors={state.errors ?? {}} />
      {state.errors?.form && <p className="text-sm text-destructive">{t(`errors.${state.errors.form}`)}</p>}
      {state.saved && (
        <p id="session-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : props.id ? t("save") : t("create")}
        </Button>
        {props.id && (
          <Link href="/admin/academic/sessions" className={buttonVariants({ variant: "outline" })}>
            {t("cancel")}
          </Link>
        )}
      </div>
    </form>
  );
}

function Fields({
  types,
  suggest,
  id,
  initial,
  values,
  errors,
}: {
  types: readonly SessionType[];
  suggest?: Suggest;
  id?: number;
  initial?: Values;
  values?: Values;
  errors: Record<string, string>;
}) {
  const t = useTranslations("sessions");
  const suggestion = (type: SessionType) =>
    suggestSession(
      type,
      type === "SCHOOL" ? (suggest?.lastSchoolEnd ?? null) : (suggest?.lastCollegeEnd ?? null),
      // A first college session usually starts mid-year; the school can change it.
      type === "SCHOOL" ? `${suggest?.year}-01-01` : `${suggest?.year}-07-01`,
    );
  // On an error: what was typed. Editing: the saved session. New: a suggestion.
  const start = values ?? initial ?? suggestion(types[0]);
  // Changing the type (new session only) fills in a fresh suggestion; `fill` re-creates the boxes.
  const [fill, setFill] = useState<{ n: number; v: Values }>({ n: 0, v: start });

  const error = (name: string) => {
    const code = errors[name];
    if (!code) return null;
    const [key, arg] = code.split(":"); // "overlap:2026" → the other session's name
    return (
      <p id={`session-${name}-error`} className="text-sm text-destructive">
        {t(`errors.${key}`, { name: arg ?? "" })}
      </p>
    );
  };

  return (
    <div key={fill.n} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="session-type">{t("fields.type")}</Label>
        {id ? (
          // The type of an existing session is fixed.
          <>
            <input type="hidden" name="type" value={fill.v.type} />
            <p className="text-sm">{t(`types.${fill.v.type}`)}</p>
          </>
        ) : (
          <select
            id="session-type"
            name="type"
            defaultValue={fill.v.type}
            className={selectClass}
            onChange={(e) => setFill({ n: fill.n + 1, v: suggestion(e.target.value as SessionType) })}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        )}
        {error("type")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-name">{t("fields.name")}</Label>
        <Input id="session-name" name="name" defaultValue={fill.v.name} maxLength={20} aria-invalid={!!errors.name} />
        {error("name")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="session-start">{t("fields.startDate")}</Label>
          <Input id="session-start" type="date" name="startDate" defaultValue={fill.v.startDate} aria-invalid={!!errors.startDate} />
          {error("startDate")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-end">{t("fields.endDate")}</Label>
          <Input id="session-end" type="date" name="endDate" defaultValue={fill.v.endDate} aria-invalid={!!errors.endDate} />
        </div>
      </div>
      {error("endDate")}
    </div>
  );
}
