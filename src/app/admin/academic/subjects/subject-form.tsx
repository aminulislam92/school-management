"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NamedFormState } from "@/server/academic/class-actions";
import { createSubjectAction, updateSubjectAction } from "@/server/academic/subject-actions";
import { paperNames, RELIGIONS, SUBJECT_KINDS } from "@/server/academic/subject-schema";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Values = Record<string, string>;

function useFieldError(errors: Record<string, string>) {
  const t = useTranslations("subjectsPage");
  return function fieldError(name: string) {
    const code = errors[name];
    if (!code) return null;
    const [key, arg] = code.split(":");
    return (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${key}`, { codes: arg ?? "" })}
      </p>
    );
  };
}

function Text({ name, label, values, errors, ...props }: { name: string; label: string; values: Values; errors: Record<string, string> } & React.ComponentProps<typeof Input>) {
  const error = useFieldError(errors);
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={values[name] ?? ""} aria-invalid={!!errors[name]} {...props} />
      {error(name)}
    </div>
  );
}

function ReligionSelect({ values }: { values: Values }) {
  const t = useTranslations("subjectsPage");
  return (
    <div className="space-y-2">
      <Label htmlFor="religion">{t("religion")}</Label>
      <select id="religion" name="religion" defaultValue={values.religion ?? ""} className={selectClass}>
        <option value="">{t("notReligion")}</option>
        {RELIGIONS.map((r) => (
          <option key={r} value={r}>
            {t(`religions.${r}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NewSubjectForm() {
  const t = useTranslations("subjectsPage");
  const [state, formAction, pending] = useActionState<NamedFormState, FormData>(createSubjectAction, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <NewFields key={state.at ?? 0} values={state.values ?? { kind: "SINGLE" }} errors={state.errors ?? {}} />
      {state.saved && (
        <p id="form-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("saved")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("create")}
      </Button>
    </form>
  );
}

function NewFields({ values, errors }: { values: Values; errors: Record<string, string> }) {
  const t = useTranslations("subjectsPage");
  // Radios stay uncontrolled (defaultChecked); we only watch which one is picked.
  const [kind, setKind] = useState(values.kind || "SINGLE");
  const [names, setNames] = useState({ bn: values.nameBn ?? "", en: values.nameEn ?? "" });
  const papers = paperNames(names.bn || "…", names.en || "…");
  const fieldProps = { values, errors };

  return (
    <div className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t("kind")}</legend>
        {SUBJECT_KINDS.map((k) => (
          <label key={k} className="flex items-center gap-2 rounded-md border p-2 text-sm has-checked:border-primary has-checked:bg-primary/5">
            <input type="radio" name="kind" value={k} defaultChecked={kind === k} onChange={() => setKind(k)} className="size-4 accent-primary" />
            {t(`kinds.${k}`)}
          </label>
        ))}
      </fieldset>
      <Text name="nameBn" label={t("nameBn")} placeholder={kind === "TWO_PAPER" ? "বাংলা" : "গণিত"} onChange={(e) => setNames((n) => ({ ...n, bn: e.target.value }))} {...fieldProps} />
      <Text name="nameEn" label={t("nameEn")} placeholder={kind === "TWO_PAPER" ? "Bangla" : "Mathematics"} onChange={(e) => setNames((n) => ({ ...n, en: e.target.value }))} {...fieldProps} />
      {kind === "SINGLE" ? (
        <>
          <Text name="code" label={t("code")} placeholder="109" className="max-w-32" {...fieldProps} />
          <ReligionSelect values={values} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Text name="code1" label={t("code1")} placeholder="101" {...fieldProps} />
            <Text name="code2" label={t("code2")} placeholder="102" {...fieldProps} />
          </div>
          <p id="papers-preview" className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {t("papersPreview", { first: papers[0].nameBn, second: papers[1].nameBn })}
          </p>
        </>
      )}
    </div>
  );
}

/** Edit one subject. Combined parents have no code box (it follows the papers); only single subjects have a religion. */
export function EditSubjectForm({ id, initial, showCode, showReligion }: { id: number; initial: Values; showCode: boolean; showReligion: boolean }) {
  const t = useTranslations("subjectsPage");
  const [state, formAction, pending] = useActionState<NamedFormState, FormData>(updateSubjectAction, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const error = useFieldError(errors);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <div key={state.at ?? 0} className="space-y-4">
        <Text name="nameBn" label={t("nameBn")} values={values} errors={errors} />
        <Text name="nameEn" label={t("nameEn")} values={values} errors={errors} />
        {showCode && <Text name="code" label={t("code")} className="max-w-32" values={values} errors={errors} />}
        {showReligion && <ReligionSelect values={values} />}
      </div>
      {error("form")}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        <Link href="/admin/academic/subjects" className={buttonVariants({ variant: "outline" })}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
