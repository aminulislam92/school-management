import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { listClasses, listGroups } from "@/server/academic/classes";
import { deleteSectionAction, setSectionActiveAction } from "@/server/academic/section-actions";
import { listSections } from "@/server/academic/sections";
import { RowActionButton } from "../_components/row-action-button";
import { SectionForm } from "./section-form";

type SearchParams = Promise<{ class?: string | string[] }>;

export default async function SectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("sectionsPage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-6xl" />}>
        <Sections searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sections({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const t = await getTranslations("sectionsPage");
  const format = await getFormatter();
  const bn = (await getLocale()) === "bn";
  const [sections, classes, groups] = await Promise.all([listSections(sdb), listClasses(sdb), listGroups(sdb)]);
  const name = (x: { nameBn: string; nameEn: string }) => (bn ? x.nameBn : x.nameEn);

  const activeClasses = classes.filter((c) => c.isActive);
  const wanted = Number((await searchParams).class);
  const startClass = activeClasses.find((c) => c.id === wanted) ?? activeClasses[0];
  // Classes that are on, or still have sections.
  const shown = classes.filter((c) => c.isActive || sections.some((s) => s.classId === c.id));

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("version")}</TableHead>
              <TableHead>{t("shift")}</TableHead>
              <TableHead>{t("group")}</TableHead>
              <TableHead className="text-right">{t("students")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => {
              const list = sections.filter((s) => s.classId === c.id);
              return [
                <TableRow key={`c${c.id}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={6} className="py-1.5 font-medium">
                    {name(c)}
                    {list.length === 0 && (
                      <Link href={`/admin/academic/sections?class=${c.id}`} className="ml-3 text-xs font-normal text-muted-foreground underline">
                        {t("noSectionsAdd")}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>,
                ...list.map((s) => (
                  <TableRow key={s.id} data-section={`${c.nameEn}/${s.name}/${s.shift}/${s.version}`} className={s.isActive ? undefined : "text-muted-foreground"}>
                    <TableCell className="pl-6 font-medium">
                      {s.name}
                      {!s.isActive && (
                        <Badge variant="outline" className="ml-2">
                          {t("off")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{t(`versions.${s.version}`)}</TableCell>
                    <TableCell className="text-sm">{t(`shifts.${s.shift}`)}</TableCell>
                    <TableCell className="text-sm">{s.group ? name(s.group) : c.hasGroups ? t("mixedGroups") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.capacity ? t("studentsOf", { count: s.students, capacity: s.capacity }) : format.number(s.students)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link href={`/admin/academic/sections/${s.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          {t("edit")}
                        </Link>
                        <RowActionButton action={setSectionActiveAction} fields={{ id: s.id, active: s.isActive ? "0" : "1" }} label={s.isActive ? t("turnOff") : t("turnOn")} />
                        {!s.everUsed && <RowActionButton action={deleteSectionAction} fields={{ id: s.id }} label={t("delete")} confirmLabel={t("confirmDelete")} />}
                      </div>
                    </TableCell>
                  </TableRow>
                )),
              ];
            })}
          </TableBody>
        </Table>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
          <CardDescription>{t("newHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionForm
            classes={activeClasses.map((c) => ({ id: c.id, name: name(c), hasGroups: c.hasGroups }))}
            groups={groups.filter((g) => g.isActive).map((g) => ({ id: g.id, name: name(g) }))}
            initial={{ classId: String(startClass?.id ?? ""), names: "", version: "BANGLA", shift: "MORNING", groupId: "", capacity: "" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
