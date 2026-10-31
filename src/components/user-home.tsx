import type { Role } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logoutAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/dal";

// Temporary landing page after login, shared by /super, /admin and /portal.
// Real dashboards replace it in later tasks (T1.6, T1.9, T5.13).
export async function UserHome({ allowedRoles, area }: { allowedRoles: Role[]; area: string }) {
  const user = await requireUser(allowedRoles);
  const t = await getTranslations();
  const locale = await getLocale();
  const name = (locale === "bn" && user.nameBn) || user.nameEn;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{t("home.welcomeUser", { name })}</CardTitle>
        <CardDescription>{t(`areas.${area}`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {t(`roles.${role}`)}
            </Badge>
          ))}
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            {t("auth.signOut")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
