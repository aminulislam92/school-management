import { Suspense } from "react";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Temporary home page that proves fonts, shadcn/ui and both languages work.
export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t("app.name")}</CardTitle>
          <CardDescription>{t("app.tagline")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t("home.setupDone")}</p>
          {/* Request-time data gets its own Suspense so the rest of the page shows instantly. */}
          <Suspense fallback={<p className="h-5" />}>
            <Today />
          </Suspense>
          <LocaleSwitcher />
        </CardContent>
      </Card>
    </main>
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
