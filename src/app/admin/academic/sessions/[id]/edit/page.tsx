import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { getSession } from "@/server/academic/sessions";
import { SessionForm } from "../../session-form";

type Params = Promise<{ id: string }>;

export default async function EditSessionPage({ params }: { params: Params }) {
  const t = await getTranslations("sessions");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-72 max-w-md" />}>
        <EditSession params={params} />
      </Suspense>
    </div>
  );
}

async function EditSession({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  // Through `sdb`: another school's session id simply isn't found.
  const session = Number.isInteger(id) && id > 0 ? await getSession(sdb, id) : null;
  if (!session) notFound();

  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <SessionForm types={[session.type]} id={session.id} initial={session} />
      </CardContent>
    </Card>
  );
}
