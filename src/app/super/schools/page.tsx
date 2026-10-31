import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/dal";
import { listSchools } from "@/server/super/schools";

export default async function SchoolsPage() {
  const t = await getTranslations("schools");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/super/schools/new" className={buttonVariants()}>
          <Plus className="size-4" />
          {t("new")}
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <SchoolsTable />
      </Suspense>
    </div>
  );
}

// The full list with search, details and suspend/activate comes in T1.12.
async function SchoolsTable() {
  await requirePermission("super.manage");
  const t = await getTranslations("schools");
  const format = await getFormatter();
  const schools = await listSchools();

  if (schools.length === 0) return <p className="text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fields.nameBn")}</TableHead>
            <TableHead>{t("fields.code")}</TableHead>
            <TableHead>{t("fields.plan")}</TableHead>
            <TableHead>{t("subscription")}</TableHead>
            <TableHead className="text-right">{t("students")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((s) => {
            const sub = s.subscriptions[0];
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.nameBn}</div>
                  <div className="text-xs text-muted-foreground">{s.nameEn}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{s.code}</TableCell>
                <TableCell>{sub?.plan.name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {sub
                    ? t("subUntil", { status: t(`subStatus.${sub.status}`), date: format.dateTime(sub.endsAt, { dateStyle: "medium" }) })
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{format.number(s._count.students)}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "ACTIVE" ? "secondary" : "outline"}>{t(`schoolStatus.${s.status}`)}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
