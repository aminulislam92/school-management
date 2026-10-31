import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/dal";
import { togglePlanAction } from "@/server/super/plan-actions";
import type { PlanFeature } from "@/server/super/plan-schema";
import { listPlans } from "@/server/super/plans";

export default async function PlansPage() {
  const t = await getTranslations("plans");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/super/plans/new" className={buttonVariants()}>
          <Plus className="size-4" />
          {t("new")}
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <PlansTable />
      </Suspense>
    </div>
  );
}

async function PlansTable() {
  await requirePermission("super.manage");
  const t = await getTranslations("plans");
  const format = await getFormatter();
  const plans = await listPlans();

  if (plans.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fields.name")}</TableHead>
            <TableHead className="text-right">{t("fields.price")}</TableHead>
            <TableHead className="text-right">{t("fields.maxStudents")}</TableHead>
            <TableHead>{t("fields.features")}</TableHead>
            <TableHead className="text-right">{t("schoolsUsing")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id} className={plan.isActive ? undefined : "text-muted-foreground"}>
              <TableCell className="font-medium">{plan.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(Number(plan.price), { style: "currency", currency: "BDT" })}
                <span className="text-xs text-muted-foreground"> / {t(`per.${plan.billingCycle}`)}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{format.number(plan.maxStudents)}</TableCell>
              <TableCell>
                <div className="flex max-w-xs flex-wrap gap-1">
                  {(plan.features as PlanFeature[]).map((f) => (
                    <Badge key={f} variant="outline" className="font-normal">
                      {t(`features.${f}`)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{format.number(plan._count.subscriptions)}</TableCell>
              <TableCell>
                <Badge variant={plan.isActive ? "secondary" : "outline"}>
                  {plan.isActive ? t("active") : t("inactive")}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Link href={`/super/plans/${plan.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    {t("edit")}
                  </Link>
                  <form action={togglePlanAction}>
                    <input type="hidden" name="id" value={plan.id} />
                    <input type="hidden" name="active" value={plan.isActive ? "0" : "1"} />
                    <Button type="submit" variant="ghost" size="sm">
                      {plan.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
