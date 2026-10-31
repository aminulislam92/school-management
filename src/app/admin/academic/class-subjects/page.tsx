import { Fragment, Suspense } from "react";
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
import { removeClassSubjectAction } from "@/server/academic/class-subject-actions";
import { listClassSubjects, pickableSubjects, type ClassSubjectRow } from "@/server/academic/class-subjects";
import { canHaveGroups, listClasses, listGroups } from "@/server/academic/classes";
import { totalFull } from "@/server/services/marks-split";
import { RowActionButton } from "../_components/row-action-button";
import { ClassSubjectForm, CopyForm } from "./class-subject-form";

type SearchParams = Promise<{ class?: string | string[] }>;

export default async function ClassSubjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("classSubjects");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-6xl" />}>
        <ClassSubjects searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ClassSubjects({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const t = await getTranslations("classSubjects");
  const format = await getFormatter();
  const bn = (await getLocale()) === "bn";
  const name = (x: { nameBn: string; nameEn: string }) => (bn ? x.nameBn : x.nameEn);

  const classes = (await listClasses(sdb)).filter((c) => c.isActive);
  const wanted = Number((await searchParams).class);
  const cls = classes.find((c) => c.id === wanted) ?? classes[0];
  if (!cls) return <p className="text-muted-foreground">{t("noClasses")}</p>;

  const [rows, subjects, groups, counts] = await Promise.all([
    listClassSubjects(sdb, cls.id),
    pickableSubjects(sdb),
    listGroups(sdb),
    sdb.classSubject.groupBy({ by: ["classId"], _count: { _all: true } }),
  ]);
  const activeGroups = groups.filter((g) => g.isActive);
  const countOf = (id: number) => counts.find((c) => c.classId === id)?._count._all ?? 0;

  // Sections of the table: all students / all groups first, then each group.
  const blocks: { key: string; title: string; list: ClassSubjectRow[] }[] = [
    { key: "all", title: cls.hasGroups ? t("allGroups") : t("allStudents"), list: rows.filter((r) => r.groupId === null) },
    ...activeGroups.filter(() => cls.hasGroups).map((g) => ({ key: `g${g.id}`, title: name(g), list: rows.filter((r) => r.groupId === g.id) })),
  ].filter((b) => b.key === "all" || b.list.length > 0);

  const marks = (full: number, pass: number) => (full ? `${format.number(full)} / ${format.number(pass)}` : "—");

  return (
    <div className="max-w-6xl space-y-4">
      <nav aria-label={t("pickClass")} className="flex flex-wrap gap-1">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/admin/academic/class-subjects?class=${c.id}`}
            aria-current={c.id === cls.id ? "page" : undefined}
            className={cn(buttonVariants({ variant: c.id === cls.id ? "secondary" : "ghost", size: "sm" }))}
          >
            {name(c)}
            <span className="text-xs text-muted-foreground tabular-nums">{format.number(countOf(c.id))}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty", { name: name(cls) })}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-right">{t("sortOrderShort")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    {(["written", "mcq", "practical"] as const).map((p) => (
                      <TableHead key={p} className="text-right whitespace-nowrap">
                        {t(`parts.${p}`)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t("total")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((b) => (
                    <Fragment key={b.key}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={8} className="py-1.5 font-medium">
                          {b.title}
                        </TableCell>
                      </TableRow>
                      {b.list.map((r) => (
                        <TableRow key={r.id} data-cs={r.subject.code} className={r.subject.isActive ? undefined : "text-muted-foreground"}>
                          <TableCell className="text-right tabular-nums">{format.number(r.sortOrder)}</TableCell>
                          <TableCell>
                            <span className="mr-2 font-mono text-xs text-muted-foreground">{r.subject.code}</span>
                            {name(r.subject)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.type === "COMPULSORY" ? "secondary" : "outline"}>{t(`types.${r.type}`)}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{marks(r.writtenFull, r.writtenPass)}</TableCell>
                          <TableCell className="text-right tabular-nums">{marks(r.mcqFull, r.mcqPass)}</TableCell>
                          <TableCell className="text-right tabular-nums">{marks(r.practicalFull, r.practicalPass)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{format.number(totalFull(r))}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Link href={`/admin/academic/class-subjects/${r.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                                {t("edit")}
                              </Link>
                              <RowActionButton action={removeClassSubjectAction} fields={{ id: r.id }} label={t("remove")} confirmLabel={t("confirmRemove")} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("papersNote")}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("addTitle", { name: name(cls) })}</CardTitle>
              {subjects.length === 0 && <CardDescription>{t("noSubjects")}</CardDescription>}
            </CardHeader>
            <CardContent>
              <ClassSubjectForm
                key={cls.id}
                classId={cls.id}
                hasGroups={cls.hasGroups}
                canOptional={canHaveGroups(cls.order)}
                subjects={subjects.map((s) => ({ id: s.id, label: `${s.code} ${name(s)}${s.isCombined ? ` (${t("twoPapers")})` : ""}`, religion: s.religion, isCombined: s.isCombined }))}
                groups={activeGroups.map((g) => ({ id: g.id, name: name(g) }))}
                initial={{ subjectId: "", groupId: "", type: "COMPULSORY", writtenFull: "100", writtenPass: "", mcqFull: "", mcqPass: "", practicalFull: "", practicalPass: "", sortOrder: "" }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("copyTitle")}</CardTitle>
              <CardDescription>{t("copyHint", { name: name(cls) })}</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyForm
                key={cls.id}
                toClassId={cls.id}
                classes={classes.filter((c) => c.id !== cls.id && countOf(c.id) > 0).map((c) => ({ id: c.id, name: name(c), count: countOf(c.id) }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
