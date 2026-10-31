import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { updateClassAction } from "@/server/academic/class-actions";
import { canHaveGroups, getClass } from "@/server/academic/classes";
import { NameForm } from "../../../_components/name-form";

type Params = Promise<{ id: string }>;

export default async function EditClassPage({ params }: { params: Params }) {
  const t = await getTranslations("classes");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-72 max-w-md" />}>
        <EditClass params={params} />
      </Suspense>
    </div>
  );
}

async function EditClass({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  const cls = Number.isInteger(id) && id > 0 ? await getClass(sdb, id) : null; // through sdb: other schools' ids aren't found
  if (!cls) notFound();
  const t = await getTranslations("classes");
  const tl = await getTranslations("schools.levels");

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{cls.nameBn}</CardTitle>
        <CardDescription>{t("editHint", { level: tl(cls.level), order: cls.order })}</CardDescription>
      </CardHeader>
      <CardContent>
        <NameForm
          action={updateClassAction}
          id={cls.id}
          initial={cls}
          showGroups={canHaveGroups(cls.order)}
          cancelHref="/admin/academic/classes"
          submitLabel={t("save")}
        />
      </CardContent>
    </Card>
  );
}
