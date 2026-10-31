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
import { saveGroupAction, setGroupActiveAction } from "@/server/academic/class-actions";
import { listClasses, listGroups } from "@/server/academic/classes";
import { NameForm } from "../_components/name-form";
import { RowActionButton } from "../_components/row-action-button";

export default async function GroupsPage() {
  const t = await getTranslations("groups");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72 w-full max-w-5xl" />}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Groups() {
  await requirePermission("academic.manage");
  const { sdb } = await getSchoolDb();
  const t = await getTranslations("groups");
  const format = await getFormatter();
  const bn = (await getLocale()) === "bn";
  const [groups, classes] = await Promise.all([listGroups(sdb), listClasses(sdb)]);
  const groupClasses = classes.filter((c) => c.isActive && c.hasGroups).map((c) => (bn ? c.nameBn : c.nameEn));

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        <p className="text-sm">
          {groupClasses.length > 0 ? t("usedIn", { classes: groupClasses.join(", ") }) : t("noGroupClasses")}
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead className="text-right">{t("sections")}</TableHead>
                  <TableHead className="text-right">{t("students")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id} data-group={g.nameEn} className={g.isActive ? undefined : "text-muted-foreground"}>
                    <TableCell>
                      <span className="font-medium">{bn ? g.nameBn : g.nameEn}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{bn ? g.nameEn : g.nameBn}</span>
                      {!g.isActive && (
                        <Badge variant="outline" className="ml-2">
                          {t("off")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{format.number(g.sections)}</TableCell>
                    <TableCell className="text-right tabular-nums">{format.number(g.students)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link href={`/admin/academic/groups/${g.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          {t("edit")}
                        </Link>
                        <RowActionButton
                          action={setGroupActiveAction}
                          fields={{ id: g.id, active: g.isActive ? "0" : "1" }}
                          label={g.isActive ? t("turnOff") : t("turnOn")}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
          <CardDescription>{t("newHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm action={saveGroupAction} initial={{ nameBn: "", nameEn: "" }} submitLabel={t("create")} />
        </CardContent>
      </Card>
    </div>
  );
}
