import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { deleteSubjectAction, setSubjectActiveAction } from "@/server/academic/subject-actions";
import { listSubjects } from "@/server/academic/subjects";
import { RowActionButton } from "../_components/row-action-button";
import { NewSubjectForm } from "./subject-form";

export default async function SubjectsPage() {
  const t = await getTranslations("subjectsPage");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-6xl" />}>
        <Subjects />
      </Suspense>
    </div>
  );
}

async function Subjects() {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const t = await getTranslations("subjectsPage");
  const format = await getFormatter();
  const bn = (await getLocale()) === "bn";
  const subjects = await listSubjects(sdb);

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-right">{t("classes")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id} data-subject={s.code} className={cn(!s.isActive && "text-muted-foreground", s.isPaper && "border-0")}>
                  <TableCell className={cn("font-mono text-sm", s.isPaper && "pl-6")}>{s.code}</TableCell>
                  <TableCell>
                    <span className={s.isPaper ? undefined : "font-medium"}>{bn ? s.nameBn : s.nameEn}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{bn ? s.nameEn : s.nameBn}</span>
                    {s.isCombined && (
                      <Badge variant="secondary" className="ml-2">
                        {t("twoPapers")}
                      </Badge>
                    )}
                    {s.religion && (
                      <Badge variant="outline" className="ml-2">
                        {t(`religions.${s.religion}`)}
                      </Badge>
                    )}
                    {!s.isActive && !s.isPaper && (
                      <Badge variant="outline" className="ml-2">
                        {t("off")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.isCombined ? "" : format.number(s.classes)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Link href={`/admin/academic/subjects/${s.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        {t("edit")}
                      </Link>
                      {!s.isPaper && (
                        <RowActionButton action={setSubjectActiveAction} fields={{ id: s.id, active: s.isActive ? "0" : "1" }} label={s.isActive ? t("turnOff") : t("turnOn")} />
                      )}
                      {!s.isPaper && !s.used && <RowActionButton action={deleteSubjectAction} fields={{ id: s.id }} label={t("delete")} confirmLabel={t("confirmDelete")} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
          <CardDescription>{t("newHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <NewSubjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
