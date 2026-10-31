import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/dal";
import { STAFF_ROLES } from "@/server/auth/permissions";

// School panel home. Real numbers (attendance, collection, dues) come in T5.18.
export default function AdminHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-24 w-full max-w-2xl" />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await requireUser([...STAFF_ROLES]);
  const t = await getTranslations();
  const locale = await getLocale();
  const name = (locale === "bn" && user.nameBn) || user.nameEn;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("home.welcomeUser", { name })}</h1>
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {t(`roles.${role}`)}
            </Badge>
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.comingTitle")}</CardTitle>
          <CardDescription>{t("dashboard.comingText")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
