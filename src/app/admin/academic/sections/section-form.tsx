"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NamedFormState } from "@/server/academic/class-actions";
import { saveSectionAction } from "@/server/academic/section-actions";
import { SHIFTS, VERSIONS } from "@/server/academic/section-schema";

export type ClassChoice = { id: number; name: string; hasGroups: boolean };
export type GroupChoice = { id: number; name: string };
type Values = { classId: string; names: string; version: string; shift: string; groupId: string; capacity: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-60";

/** New sections (no `id`) or edit one (with `id`). */
export function SectionForm(props: { classes: ClassChoice[]; groups: GroupChoice[]; initial: Values; id?: number }) {
  const t = useTranslations("sectionsPage");
  const [state, formAction, pending] = useActionState<NamedFormState, FormData>(saveSectionAction, {});
  const values = (state.values as Values | undefined) ?? props.initial;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {props.id && <input type="hidden" name="id" value={props.id} />}
      <Fields key={state.at ?? 0} {...props} values={values} errors={state.errors ?? {}} />
      {state.errors?.form && (
        <p id="form-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${state.errors.form}`)}
        </p>
      )}
      {state.saved && (
        <p id="form-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || props.classes.length === 0}>
          {pending ? t("saving") : props.id ? t("save") : t("create")}
        </Button>
        {props.id && (
          <Link href="/admin/academic/sections" className={buttonVariants({ variant: "outline" })}>
            {t("cancel")}
          </Link>
        )}
      </div>
    </form>
  );
}

function Fields({
  classes,
  groups,
  values,
  errors,
  id,
}: {
  classes: ClassChoice[];
  groups: GroupChoice[];
  values: Values;
  errors: Record<string, string>;
  id?: number;
}) {
  const t = useTranslations("sectionsPage");
  // Track the class only to show/hide the group box (the select itself stays uncontrolled).
  const [classId, setClassId] = useState(values.classId);
  const hasGroups = classes.find((c) => String(c.id) === classId)?.hasGroups ?? false;

  const error = (name: string) => {
    const code = errors[name];
    if (!code) return null;
    const [key, arg] = code.split(":"); // "exists:ক, খ" → which names already exist
    return (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${key}`, { names: arg ?? "", count: Number(arg) || 0 })}
      </p>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="classId">{t("class")}</Label>
        {id ? (
          <>
            {/* A section's class is fixed. */}
            <input type="hidden" name="classId" value={values.classId} />
            <p className="text-sm">{classes.find((c) => String(c.id) === values.classId)?.name}</p>
          </>
        ) : (
          <select id="classId" name="classId" defaultValue={values.classId} onChange={(e) => setClassId(e.target.value)} className={selectClass} aria-invalid={!!errors.classId}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {error("classId")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="names">{id ? t("name") : t("names")}</Label>
        <Input id="names" name="names" defaultValue={values.names} placeholder={id ? "" : t("namesPlaceholder")} aria-invalid={!!errors.names} />
        {!id && !errors.names && <p className="text-xs text-muted-foreground">{t("namesHint")}</p>}
        {error("names")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="version">{t("version")}</Label>
          <select id="version" name="version" defaultValue={values.version} className={selectClass}>
            {VERSIONS.map((v) => (
              <option key={v} value={v}>
                {t(`versions.${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift">{t("shift")}</Label>
          <select id="shift" name="shift" defaultValue={values.shift} className={selectClass}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {t(`shifts.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hasGroups ? (
        <div className="space-y-2">
          <Label htmlFor="groupId">{t("group")}</Label>
          <select id="groupId" name="groupId" defaultValue={values.groupId} className={selectClass} aria-invalid={!!errors.groupId}>
            <option value="">{t("mixedGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {error("groupId")}
        </div>
      ) : (
        <input type="hidden" name="groupId" value="" />
      )}
      <div className="space-y-2">
        <Label htmlFor="capacity">{t("capacity")}</Label>
        <Input id="capacity" name="capacity" inputMode="numeric" defaultValue={values.capacity} placeholder={t("capacityPlaceholder")} className="max-w-32" aria-invalid={!!errors.capacity} />
        {error("capacity")}
      </div>
    </div>
  );
}
