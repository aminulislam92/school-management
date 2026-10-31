import { Suspense } from "react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/auth/dal";

// Super admin home: a few totals across all schools. The full dashboard
// (income, expiring subscriptions) comes in T6.4.
export default function SuperHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full max-w-3xl" />}>
      <SuperHome />
    </Suspense>
  );
}

async function SuperHome() {
  const user = await requirePermission("super.manage");
  const t = await getTranslations();
  const format = await getFormatter();
  const locale = await getLocale();
  const name = (locale === "bn" && user.nameBn) || user.nameEn;

  // Plain `db` is right here: the super admin looks across all schools.
  const [schools, activeSchools, students, subscriptions] = await Promise.all([
    db.school.count(),
    db.school.count({ where: { status: "ACTIVE" } }),
    db.student.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: { in: ["TRIAL", "ACTIVE", "GRACE"] } } }),
  ]);

  const stats = [
    { label: t("super.stats.schools"), value: schools, note: t("super.stats.activeSchools", { count: activeSchools }) },
    { label: t("super.stats.subscriptions"), value: subscriptions, note: t("super.stats.subscriptionsNote") },
    { label: t("super.stats.students"), value: students, note: t("super.stats.studentsNote") },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("home.welcomeUser", { name })}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{format.number(s.value)}</CardTitle>
              <p className="text-xs text-muted-foreground">{s.note}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
