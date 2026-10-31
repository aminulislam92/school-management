"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSchoolAction, type NewSchoolState } from "@/server/super/school-actions";
import { EDUCATION_BOARDS, LEVELS, type NewSchoolField } from "@/server/super/school-schema";

export type PlanOption = { id: number; label: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function NewSchoolForm({ plans, rootHost }: { plans: PlanOption[]; rootHost: string }) {
  const t = useTranslations("schools");
  const [state, formAction, pending] = useActionState<NewSchoolState, FormData>(createSchoolAction, {});
  const [code, setCode] = useState("");

  if (state.created) return <Created created={state.created} />;

  const v = state.values ?? {};
  const val = (k: string, fallback = "") => (typeof v[k] === "string" ? (v[k] as string) : fallback);
  const levels = Array.isArray(v.levels) ? v.levels : ["PRIMARY", "SECONDARY"];
  const err = state.errors ?? {};

  const field = (name: NewSchoolField, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField name={name} label={label} defaultValue={val(name)} error={errorText(name)} {...props} />
  );
  const errorText = (name: NewSchoolField) => (err[name] ? t(`errors.${err[name]}`) : undefined);

  return (
    <form action={formAction} className="max-w-2xl space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("sections.school")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("nameBn", t("fields.nameBn"), { placeholder: t("placeholders.nameBn"), required: true })}
          {field("nameEn", t("fields.nameEn"), { placeholder: t("placeholders.nameEn"), required: true })}
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">{t("fields.code")}</Label>
          <Input
            id="code"
            name="code"
            defaultValue={val("code")}
            onChange={(e) => setCode(e.target.value.trim().toLowerCase())}
            placeholder="adarsha"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!err.code}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("codeHint")} <span className="font-mono text-foreground">{(code || val("code") || "code")}.{rootHost}</span>
          </p>
          <ErrorText id="code-error" text={errorText("code")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("eiin", t("fields.eiin"), { inputMode: "numeric" })}
          <div className="space-y-2">
            <Label htmlFor="board">{t("fields.board")}</Label>
            <select id="board" name="board" defaultValue={val("board")} className={selectClass}>
              <option value="">{t("none")}</option>
              {EDUCATION_BOARDS.map((b) => (
                <option key={b} value={b}>
                  {t(`boards.${b}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("fields.levels")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEVELS.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="levels" value={l} defaultChecked={levels.includes(l)} className="size-4 accent-primary" />
                {t(`levels.${l}`)}
              </label>
            ))}
          </div>
          <ErrorText id="levels-error" text={errorText("levels")} />
        </fieldset>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("sections.contact")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("phone", t("fields.phone"), { inputMode: "tel", placeholder: "01XXXXXXXXX" })}
          {field("email", t("fields.email"), { type: "email" })}
          {field("district", t("fields.district"))}
          {field("upazila", t("fields.upazila"))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("sections.plan")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="planId">{t("fields.plan")}</Label>
            <select id="planId" name="planId" defaultValue={val("planId", String(plans[0]?.id ?? ""))} className={selectClass} aria-invalid={!!err.planId}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ErrorText id="planId-error" text={errorText("planId")} />
          </div>
          {field("trialDays", t("fields.trialDays"), { type: "number", min: 0, max: 90, defaultValue: val("trialDays", "30") })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">{t("sections.admin")}</h2>
          <p className="text-sm text-muted-foreground">{t("adminHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("adminNameBn", t("fields.adminNameBn"))}
          {field("adminNameEn", t("fields.adminNameEn"), { required: true })}
          {field("adminEmail", t("fields.adminEmail"), { type: "email", autoCapitalize: "none" })}
          {field("adminPhone", t("fields.adminPhone"), { inputMode: "tel", placeholder: "01XXXXXXXXX" })}
        </div>
      </section>

      {err.form && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${err.form}`)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || plans.length === 0}>
          {pending ? t("creating") : t("create")}
        </Button>
        <Link href="/super/schools" className={buttonVariants({ variant: "outline" })}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function ErrorText({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="text-sm text-destructive">
      {text}
    </p>
  ) : null;
}

// Defined outside the form so React keeps the same input between renders
// (a component created inside render would be re-mounted and lose what was typed).
function FormField({
  name,
  label,
  error,
  ...props
}: { name: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={!!error} {...props} />
      <ErrorText id={`${name}-error`} text={error} />
    </div>
  );
}

function Created({ created }: { created: NonNullable<NewSchoolState["created"]> }) {
  const t = useTranslations("schools");
  const [copied, setCopied] = useState(false);

  return (
    <Card className="max-w-xl border-emerald-600/40">
      <CardHeader>
        <CardTitle id="school-created">{t("created.title", { name: created.nameBn })}</CardTitle>
        <CardDescription>{t("created.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("created.url")}</dt>
          <dd>
            <a href={`${created.url}/login`} target="_blank" rel="noreferrer" className="font-mono underline">
              {created.url}/login
            </a>
          </dd>
          <dt className="text-muted-foreground">{t("created.login")}</dt>
          <dd className="font-mono">{created.adminLogin}</dd>
          <dt className="text-muted-foreground">{t("created.password")}</dt>
          <dd className="flex items-center gap-2">
            <span id="temp-password" className="rounded bg-muted px-2 py-1 font-mono text-base tracking-wider">
              {created.tempPassword}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(created.tempPassword);
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t("created.copied") : t("created.copy")}
            </Button>
          </dd>
        </dl>
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t("created.warning")}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* A full page load on purpose: it clears the form and the one-time password. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/super/schools/new" className={buttonVariants({ variant: "outline" })}>
            {t("created.another")}
          </a>
          <Link href="/super/schools" className={buttonVariants()}>
            {t("created.list")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
