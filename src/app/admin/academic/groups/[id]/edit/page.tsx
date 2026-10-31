import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { saveGroupAction } from "@/server/academic/class-actions";
import { getGroup } from "@/server/academic/classes";
import { NameForm } from "../../../_components/name-form";

type Params = Promise<{ id: string }>;

export default async function EditGroupPage({ params }: { params: Params }) {
  const t = await getTranslations("groups");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-60 max-w-md" />}>
        <EditGroup params={params} />
      </Suspense>
    </div>
  );
}

async function EditGroup({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  const group = Number.isInteger(id) && id > 0 ? await getGroup(sdb, id) : null;
  if (!group) notFound();
  const t = await getTranslations("groups");

  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <NameForm action={saveGroupAction} id={group.id} initial={group} cancelHref="/admin/academic/groups" submitLabel={t("save")} />
      </CardContent>
    </Card>
  );
}
