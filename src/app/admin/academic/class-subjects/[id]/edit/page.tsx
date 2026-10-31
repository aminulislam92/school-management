import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { getClassSubject } from "@/server/academic/class-subjects";
import { canHaveGroups, listGroups } from "@/server/academic/classes";
import { ClassSubjectForm } from "../../class-subject-form";

type Params = Promise<{ id: string }>;

export default async function EditClassSubjectPage({ params }: { params: Params }) {
  const t = await getTranslations("classSubjects");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-md" />}>
        <EditClassSubject params={params} />
      </Suspense>
    </div>
  );
}

async function EditClassSubject({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  const row = Number.isInteger(id) && id > 0 ? await getClassSubject(sdb, id) : null; // through sdb: other schools' rows aren't found
  if (!row) notFound();
  const t = await getTranslations("classSubjects");
  const bn = (await getLocale()) === "bn";
  const groups = (await listGroups(sdb)).filter((g) => g.isActive || g.id === row.groupId);
  const s = (n: number) => (n ? String(n) : "");
  // A pass mark is shown whenever its part has marks — even 0, so saving doesn't turn it into 33%.
  const pass = (full: number, n: number) => (full ? String(n) : "");

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{bn ? row.class.nameBn : row.class.nameEn}</CardTitle>
        {row.subject.paperOfId && <CardDescription>{t("paperEditHint")}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ClassSubjectForm
          id={row.id}
          classId={row.classId}
          hasGroups={row.class.hasGroups}
          canOptional={canHaveGroups(row.class.order)}
          subjects={[]}
          subjectLabel={`${row.subject.code} ${bn ? row.subject.nameBn : row.subject.nameEn}`}
          subjectReligion={row.subject.religion}
          groups={groups.map((g) => ({ id: g.id, name: bn ? g.nameBn : g.nameEn }))}
          initial={{
            subjectId: String(row.subject.id),
            groupId: row.groupId ? String(row.groupId) : "",
            type: row.type,
            writtenFull: s(row.writtenFull), writtenPass: pass(row.writtenFull, row.writtenPass),
            mcqFull: s(row.mcqFull), mcqPass: pass(row.mcqFull, row.mcqPass),
            practicalFull: s(row.practicalFull), practicalPass: pass(row.practicalFull, row.practicalPass),
            sortOrder: String(row.sortOrder),
          }}
        />
      </CardContent>
    </Card>
  );
}
