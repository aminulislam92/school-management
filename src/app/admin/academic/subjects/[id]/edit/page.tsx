import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { getSubject } from "@/server/academic/subjects";
import { EditSubjectForm } from "../../subject-form";

type Params = Promise<{ id: string }>;

export default async function EditSubjectPage({ params }: { params: Params }) {
  const t = await getTranslations("subjectsPage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-72 max-w-md" />}>
        <EditSubject params={params} />
      </Suspense>
    </div>
  );
}

async function EditSubject({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  const s = Number.isInteger(id) && id > 0 ? await getSubject(sdb, id) : null; // through sdb: other schools' ids aren't found
  if (!s) notFound();
  const t = await getTranslations("subjectsPage");
  const single = !s.isCombined && !s.paperOfId;

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>
          <span className="font-mono">{s.code}</span> {s.nameBn}
        </CardTitle>
        <CardDescription>{s.isCombined ? t("editCombinedHint") : s.paperOfId ? t("editPaperHint") : t("editSingleHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <EditSubjectForm
          id={s.id}
          initial={{ nameBn: s.nameBn, nameEn: s.nameEn, code: s.code, religion: s.religion ?? "" }}
          showCode={!s.isCombined}
          showReligion={single}
        />
      </CardContent>
    </Card>
  );
}
