import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/server/auth/dal";
import { PlanForm } from "../plan-form";

export default async function NewPlanPage() {
  const t = await getTranslations("plans");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <NewPlan />
      </Suspense>
    </div>
  );
}

async function NewPlan() {
  await requirePermission("super.manage");
  return (
    <PlanForm
      id={null}
      initial={{
        name: "",
        price: "",
        billingCycle: "MONTHLY",
        maxStudents: "500",
        features: ["attendance", "fees", "exams", "sms", "portal"],
        isActive: true,
      }}
    />
  );
}
