import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, homePathFor } from "@/server/auth/dal";
import { ChangePasswordForm } from "./change-password-form";

// Works on every site (main site and school sites). Users with
// mustChangePassword are sent here by requireUser() until they change it.
export default function ChangePasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <Suspense fallback={<Skeleton className="m-6 h-64" />}>
          <ChangePasswordContent />
        </Suspense>
      </Card>
    </main>
  );
}

async function ChangePasswordContent() {
  // Not requireUser(): that would send a must-change user straight back here.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getTranslations("changePassword");

  return (
    <>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{user.mustChangePassword ? t("firstLogin") : t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm cancelHref={user.mustChangePassword ? null : homePathFor(user.roles)} />
      </CardContent>
    </>
  );
}
