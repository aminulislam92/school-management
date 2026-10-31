import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSchool, getTenantHost } from "@/lib/tenant";
import { getCurrentUser, homePathFor } from "@/server/auth/dal";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <Suspense fallback={<CardHeader className="h-20" />}>
          <LoginHeader />
        </Suspense>
        <CardContent className="space-y-4">
          <LoginForm />
          <div className="flex justify-center">
            <LocaleSwitcher />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginHeader() {
  // Already logged in on this site → go straight to the right home page.
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.roles));

  const t = await getTranslations();
  const tenant = await getTenantHost();

  if (tenant.kind === "root") {
    return (
      <CardHeader>
        <CardTitle className="text-xl">{t("app.name")}</CardTitle>
        <CardDescription>{t("auth.superAdminLogin")}</CardDescription>
      </CardHeader>
    );
  }

  const school = await getCurrentSchool();
  if (!school) notFound();
  const locale = await getLocale();

  return (
    <CardHeader>
      <CardTitle className="text-xl">{locale === "bn" ? school.nameBn : school.nameEn}</CardTitle>
      <CardDescription>{t("auth.schoolLogin")}</CardDescription>
      {school.status !== "ACTIVE" && (
        <p id="school-closed" role="status" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {t("auth.errors.schoolClosed")}
        </p>
      )}
    </CardHeader>
  );
}
