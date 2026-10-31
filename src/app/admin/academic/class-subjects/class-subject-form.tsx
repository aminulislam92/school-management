"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NamedFormState } from "@/server/academic/class-actions";
import { addClassSubjectAction, copyClassSubjectsAction, type CopyState, updateClassSubjectAction } from "@/server/academic/class-subject-actions";
import { SUBJECT_TYPES } from "@/server/academic/class-subject-schema";
import { PARTS, PRESETS } from "@/server/services/marks-split";

export type SubjectChoice = { id: number; label: string; religion: string | null; isCombined: boolean };
export type GroupChoice = { id: number; name: string };
type Values = Record<string, string>;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

/** Add a subject to a class (no `id`) or edit one row (with `id` + `subjectLabel`). */
export function ClassSubjectForm(props: {
  classId: number;
  hasGroups: boolean;
  canOptional: boolean;
  subjects: SubjectChoice[];
  groups: GroupChoice[];
  initial: Values;
  id?: number;
  subjectLabel?: string;
  subjectReligion?: string | null;
}) {
  const t = useTranslations("classSubjects");
  const [state, formAction, pending] = useActionState<NamedFormState, FormData>(props.id ? updateClassSubjectAction : addClassSubjectAction, {});
  const values = state.values ?? props.initial;
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="classId" value={props.classId} />
      {props.id && <input type="hidden" name="id" value={props.id} />}
      <Fields key={state.at ?? 0} {...props} values={values} errors={errors} />
      {errors.form && (
        <p id="form-error" role="alert" className="text-sm text-destructive">
          {t(`errors.${errors.form}`)}
        </p>
      )}
      {state.saved && (
        <p id="form-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (!props.id && props.subjects.length === 0)}>
          {pending ? t("saving") : props.id ? t("save") : t("add")}
        </Button>
        {props.id && (
          <Link href={`/admin/academic/class-subjects?class=${props.classId}`} className={buttonVariants({ variant: "outline" })}>
            {t("cancel")}
          </Link>
        )}
      </div>
    </form>
  );
}

function Fields({
  hasGroups,
  canOptional,
  subjects,
  groups,
  values,
  errors,
  id,
  subjectLabel,
  subjectReligion,
}: {
  hasGroups: boolean;
  canOptional: boolean;
  subjects: SubjectChoice[];
  groups: GroupChoice[];
  values: Values;
  errors: Record<string, string>;
  id?: number;
  subjectLabel?: string;
  subjectReligion?: string | null;
}) {
  const t = useTranslations("classSubjects");
  const [subjectId, setSubjectId] = useState(values.subjectId ?? "");
  const religion = id ? (subjectReligion ?? null) : (subjects.find((s) => String(s.id) === subjectId)?.religion ?? null);
  // A religion subject is always type RELIGION; others can't be.
  const typeDefault = religion ? "RELIGION" : values.type && values.type !== "RELIGION" ? values.type : "COMPULSORY";
  const [preset, setPreset] = useState<{ n: number; v: Values }>({ n: 0, v: values });

  const error = (name: string) => {
    const code = errors[name];
    if (!code) return null;
    const [key, part] = code.split(":");
    return (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${key}`, { part: part ? t(`parts.${part}`) : "" })}
      </p>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subjectId">{t("subject")}</Label>
        {id ? (
          <>
            <input type="hidden" name="subjectId" value={values.subjectId} />
            <p className="text-sm font-medium">{subjectLabel}</p>
          </>
        ) : (
          <select id="subjectId" name="subjectId" defaultValue={values.subjectId ?? ""} onChange={(e) => setSubjectId(e.target.value)} className={selectClass} aria-invalid={!!errors.subjectId}>
            <option value="">{t("pickSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {error("subjectId")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type">{t("type")}</Label>
          {/* key: picking another subject resets the type to what fits it */}
          <select key={`${subjectId}-${typeDefault}`} id="type" name="type" defaultValue={typeDefault} className={selectClass} aria-invalid={!!errors.type}>
            {SUBJECT_TYPES.filter((ty) => (religion ? ty === "RELIGION" : ty !== "RELIGION") && (ty !== "OPTIONAL" || canOptional)).map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </select>
          {error("type")}
        </div>
        {hasGroups ? (
          <div className="space-y-2">
            <Label htmlFor="groupId">{t("group")}</Label>
            <select id="groupId" name="groupId" defaultValue={values.groupId ?? ""} className={selectClass} aria-invalid={!!errors.groupId}>
              <option value="">{t("allGroups")}</option>
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
      </div>

      <fieldset className="space-y-2" aria-describedby={errors.marks ? "marks-error" : undefined}>
        <legend className="text-sm font-medium">{t("marks")}</legend>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const v = PRESETS[p];
                setPreset({
                  n: preset.n + 1,
                  v: { writtenFull: String(v.writtenFull), mcqFull: String(v.mcqFull), practicalFull: String(v.practicalFull), writtenPass: "", mcqPass: "", practicalPass: "" },
                });
              }}
            >
              {t(`presets.${p}`)}
            </Button>
          ))}
        </div>
        <div key={preset.n} className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span />
          <span className="text-xs text-muted-foreground">{t("full")}</span>
          <span className="text-xs text-muted-foreground">{t("pass")}</span>
          {PARTS.map((part) => (
            <Row key={part} part={part} v={preset.v} invalid={!!errors.marks} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("passHint")}</p>
        {error("marks")}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="sortOrder">{t("sortOrder")}</Label>
        <Input id="sortOrder" name="sortOrder" inputMode="numeric" defaultValue={values.sortOrder ?? ""} placeholder={t("sortOrderPlaceholder")} className="max-w-28" />
      </div>
    </div>
  );
}

function Row({ part, v, invalid }: { part: (typeof PARTS)[number]; v: Values; invalid: boolean }) {
  const t = useTranslations("classSubjects");
  return (
    <>
      <Label htmlFor={`${part}Full`}>{t(`parts.${part}`)}</Label>
      <Input id={`${part}Full`} name={`${part}Full`} inputMode="numeric" defaultValue={v[`${part}Full`] ?? ""} placeholder="0" aria-invalid={invalid} />
      <Input id={`${part}Pass`} name={`${part}Pass`} inputMode="numeric" defaultValue={v[`${part}Pass`] ?? ""} placeholder="৩৩%" aria-invalid={invalid} aria-label={`${t(`parts.${part}`)} ${t("pass")}`} />
    </>
  );
}

/** "Copy subjects from Class X" for an (often empty) class. */
export function CopyForm({ toClassId, classes }: { toClassId: number; classes: { id: number; name: string; count: number }[] }) {
  const t = useTranslations("classSubjects");
  const [state, formAction, pending] = useActionState<CopyState, FormData>(copyClassSubjectsAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="toClassId" value={toClassId} />
      <select name="fromClassId" aria-label={t("copyFrom")} className={selectClass} defaultValue={classes[0]?.id}>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {t("copyOption", { name: c.name, count: c.count })}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={pending || classes.length === 0}>
        {t("copy")}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.copied ? (
        <p id="copy-done" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("copied", { count: state.copied })}
        </p>
      ) : null}
    </form>
  );
}
