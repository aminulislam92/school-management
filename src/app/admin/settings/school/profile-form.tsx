"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BD_DIVISIONS } from "@/lib/bd-locations";
import { updateSchoolProfileAction, type ProfileFormState } from "@/server/school/profile-actions";
import { EDUCATION_BOARDS } from "@/server/super/school-schema";

type Values = Record<"nameBn" | "nameEn" | "eiin" | "board" | "phone" | "email" | "division" | "district" | "upazila" | "addressLine", string>;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function ProfileForm({ initial }: { initial: Values }) {
  const t = useTranslations("schoolProfile");
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateSchoolProfileAction, {});

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* New key after every save/error: fresh fields, so React's form reset can't show stale values. */}
      <Fields key={state.at ?? 0} values={(state.values as Values | undefined) ?? initial} errors={state.errors ?? {}} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        {state.saved && (
          <p id="profile-saved" role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}

function Fields({ values, errors }: { values: Values; errors: Partial<Record<string, string>> }) {
  const t = useTranslations("schoolProfile");
  const tb = useTranslations("schools.boards");
  const bn = useLocale() === "bn";
  const [division, setDivision] = useState(values.division);
  const districts = BD_DIVISIONS.find((d) => d.en === division)?.districts ?? [];
  // A district typed earlier as free text (before this list existed) is kept as an option.
  const keepOld = values.district && !districts.some(([en]) => en === values.district) ? values.district : null;

  const error = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {t(`errors.${errors[name]}`)}
      </p>
    ) : null;

  const text = (name: keyof Values, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{t(`fields.${name}`)}</Label>
      <Input id={name} name={name} defaultValue={values[name]} aria-invalid={!!errors[name]} {...props} />
      {error(name)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {text("nameBn", { required: true })}
        {text("nameEn", { required: true })}
        {text("eiin", { inputMode: "numeric" })}
        <div className="space-y-2">
          <Label htmlFor="board">{t("fields.board")}</Label>
          <select id="board" name="board" defaultValue={values.board} className={selectClass}>
            <option value="">{t("none")}</option>
            {EDUCATION_BOARDS.map((b) => (
              <option key={b} value={b}>
                {tb(b)}
              </option>
            ))}
          </select>
        </div>
        {text("phone", { inputMode: "tel", placeholder: "01XXXXXXXXX" })}
        {text("email", { type: "email", autoCapitalize: "none" })}
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-medium">{t("address")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="division">{t("fields.division")}</Label>
            {/* defaultValue (not value): React resets a form after an action, and the browser
                can only reset a <select> to its default option. */}
            <select id="division" name="division" defaultValue={values.division} onChange={(e) => setDivision(e.target.value)} className={selectClass}>
              <option value="">{t("none")}</option>
              {BD_DIVISIONS.map((d) => (
                <option key={d.en} value={d.en}>
                  {bn ? d.bn : d.en}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">{t("fields.district")}</Label>
            {/* key: a new division starts with an empty district */}
            <select
              key={division}
              id="district"
              name="district"
              defaultValue={division === values.division ? values.district : ""}
              className={selectClass}
              aria-invalid={!!errors.district}
            >
              <option value="">{division ? t("pickDistrict") : t("pickDivisionFirst")}</option>
              {keepOld && division === values.division && <option value={keepOld}>{keepOld}</option>}
              {districts.map(([en, bnName]) => (
                <option key={en} value={en}>
                  {bn ? bnName : en}
                </option>
              ))}
            </select>
            {error("district")}
          </div>
          {text("upazila")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressLine">{t("fields.addressLine")}</Label>
          <Textarea id="addressLine" name="addressLine" defaultValue={values.addressLine} maxLength={300} placeholder={t("addressPlaceholder")} />
          {error("addressLine")}
        </div>
      </fieldset>
    </div>
  );
}
