import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSchool, getTenantHost } from "@/lib/tenant";

// Temporary home page. On the main site it shows the product name; on a school
// site (demo.localhost:3000) it shows that school. Proper pages come later.
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {/* Database and request-time data get their own Suspense boundary. */}
        <Suspense fallback={<CardHeader className="h-24" />}>
          <SiteHeader />
        </Suspense>
        <CardContent className="space-y-4">
          <Suspense fallback={<p className="h-5" />}>
            <Today />
          </Suspense>
          <LocaleSwitcher />
        </CardContent>
      </Card>
    </main>
  );
}

async function SiteHeader() {
  const t = await getTranslations();
  const tenant = await getTenantHost();

  if (tenant.kind === "root") {
    return (
      <CardHeader>
        <CardTitle className="text-2xl">{t("app.name")}</CardTitle>
        <CardDescription>{t("home.mainSite")}</CardDescription>
      </CardHeader>
    );
  }

  const school = await getCurrentSchool();
  if (!school) notFound();
  const locale = await getLocale();

  return (
    <CardHeader>
      <CardTitle className="text-2xl">{locale === "bn" ? school.nameBn : school.nameEn}</CardTitle>
      <CardDescription>
        {t("home.schoolSite")} · {school.code}
      </CardDescription>
    </CardHeader>
  );
}

// Today's date changes on every request, so it is rendered at request time.
async function Today() {
  await connection();
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <p className="text-sm text-muted-foreground">
      {t("home.today")}: {format.dateTime(new Date(), { dateStyle: "full" })}
    </p>
  );
}
