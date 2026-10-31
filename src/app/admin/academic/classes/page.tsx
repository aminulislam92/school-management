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
import { addLevelAction, setClassActiveAction } from "@/server/academic/class-actions";
import { canHaveGroups, listClasses, missingLevels } from "@/server/academic/classes";
import { RowActionButton } from "../_components/row-action-button";

export default async function ClassesPage() {
  const t = await getTranslations("classes");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-5xl" />}>
        <Classes />
      </Suspense>
    </div>
  );
}

async function Classes() {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const t = await getTranslations("classes");
  const tl = await getTranslations("schools.levels");
  const format = await getFormatter();
  const bn = (await getLocale()) === "bn";
  const [classes, missing] = await Promise.all([listClasses(sdb), missingLevels(sdb)]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">{t("order")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("level")}</TableHead>
              <TableHead>{t("groups")}</TableHead>
              <TableHead className="text-right">{t("sections")}</TableHead>
              <TableHead className="text-right">{t("students")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => (
              <TableRow key={c.id} data-class={c.nameEn} className={c.isActive ? undefined : "text-muted-foreground"}>
                <TableCell className="text-right tabular-nums">{format.number(c.order)}</TableCell>
                <TableCell>
                  <span className="font-medium">{bn ? c.nameBn : c.nameEn}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{bn ? c.nameEn : c.nameBn}</span>
                  {!c.isActive && (
                    <Badge variant="outline" className="ml-2">
                      {t("off")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{tl(c.level)}</TableCell>
                <TableCell className="text-sm">{canHaveGroups(c.order) ? (c.hasGroups ? t("withGroups") : t("noGroups")) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{format.number(c.sections)}</TableCell>
                <TableCell className="text-right tabular-nums">{format.number(c.students)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Link href={`/admin/academic/classes/${c.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {t("edit")}
                    </Link>
                    <RowActionButton
                      action={setClassActiveAction}
                      fields={{ id: c.id, active: c.isActive ? "0" : "1" }}
                      label={c.isActive ? t("turnOff") : t("turnOn")}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{t("orderNote")}</p>

      {missing.length > 0 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("addLevelTitle")}</CardTitle>
            <CardDescription>{t("addLevelHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {missing.map((level) => (
              <RowActionButton key={level} action={addLevelAction} fields={{ level }} label={t("addLevel", { level: tl(level) })} variant="outline" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
