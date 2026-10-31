import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/server/auth/dal";
import { getPlan } from "@/server/super/plans";
import { PlanForm } from "../../plan-form";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("plans");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <EditPlan params={params} />
      </Suspense>
    </div>
  );
}

async function EditPlan({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("super.manage");
  const id = Number((await params).id);
  const plan = Number.isInteger(id) ? await getPlan(id) : null;
  if (!plan) notFound();

  return (
    <PlanForm
      id={plan.id}
      initial={{
        name: plan.name,
        price: plan.price.toFixed(2),
        billingCycle: plan.billingCycle,
        maxStudents: String(plan.maxStudents),
        features: plan.features as string[],
        isActive: plan.isActive,
      }}
    />
  );
}
