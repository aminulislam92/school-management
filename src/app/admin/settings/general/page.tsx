import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { getGeneralSettings } from "@/server/school/settings";
import { GeneralSettingsForm } from "./general-settings-form";

export default async function GeneralSettingsPage() {
  const t = await getTranslations("generalSettings");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full max-w-2xl" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requirePermission("settings.manage");
  const { school, sdb } = await getSchoolDb();
  const { setting, classes } = await getGeneralSettings(sdb, school.id);
  const bn = (await getLocale()) === "bn";
  return (
    <GeneralSettingsForm
      initial={setting}
      classes={classes.map((c) => ({ order: c.order, name: bn ? c.nameBn : c.nameEn }))}
    />
  );
}
