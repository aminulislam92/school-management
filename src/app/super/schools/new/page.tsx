import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/server/auth/dal";
import { listActivePlans } from "@/server/super/schools";
import { NewSchoolForm } from "./new-school-form";

export default async function NewSchoolPage() {
  const t = await getTranslations("schools");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-[40rem] max-w-2xl" />}>
        <NewSchool />
      </Suspense>
    </div>
  );
}

async function NewSchool() {
  await requirePermission("super.manage");
  const t = await getTranslations();
  const format = await getFormatter();
  const plans = await listActivePlans();
  const rootHost = ((await headers()).get("host") ?? "localhost:3000").replace(/^www\./, "");

  if (plans.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("schools.noPlans")}{" "}
        <Link href="/super/plans/new" className="underline">
          {t("plans.new")}
        </Link>
      </p>
    );
  }

  return (
    <NewSchoolForm
      rootHost={rootHost}
      plans={plans.map((p) => ({
        id: p.id,
        label: `${p.name} — ${format.number(Number(p.price), { style: "currency", currency: "BDT" })} / ${t(`plans.per.${p.billingCycle}`)}`,
      }))}
    />
  );
}
