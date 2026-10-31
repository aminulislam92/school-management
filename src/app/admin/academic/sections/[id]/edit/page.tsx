import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { listGroups } from "@/server/academic/classes";
import { getSection } from "@/server/academic/sections";
import { SectionForm } from "../../section-form";

type Params = Promise<{ id: string }>;

export default async function EditSectionPage({ params }: { params: Params }) {
  const t = await getTranslations("sectionsPage");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-80 max-w-md" />}>
        <EditSection params={params} />
      </Suspense>
    </div>
  );
}

async function EditSection({ params }: { params: Params }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const id = Number((await params).id);
  const s = Number.isInteger(id) && id > 0 ? await getSection(sdb, id) : null; // through sdb: other schools' ids aren't found
  if (!s) notFound();
  const bn = (await getLocale()) === "bn";
  const groups = (await listGroups(sdb)).filter((g) => g.isActive || g.id === s.groupId);

  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <SectionForm
          id={s.id}
          classes={[{ id: s.classId, name: bn ? s.class.nameBn : s.class.nameEn, hasGroups: s.class.hasGroups }]}
          groups={groups.map((g) => ({ id: g.id, name: bn ? g.nameBn : g.nameEn }))}
          initial={{
            classId: String(s.classId),
            names: s.name,
            version: s.version,
            shift: s.shift,
            groupId: s.groupId ? String(s.groupId) : "",
            capacity: s.capacity ? String(s.capacity) : "",
          }}
        />
      </CardContent>
    </Card>
  );
}
