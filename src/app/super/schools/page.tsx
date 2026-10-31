import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus, Search } from "lucide-react";
import type { SchoolStatus } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import { requirePermission } from "@/server/auth/dal";
import { SCHOOL_STATUSES } from "@/server/super/school-schema";
import { countSchoolsByStatus, listSchools } from "@/server/super/schools";
import { SchoolStatusBadge } from "./school-status-badge";

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[] }>;

export default async function SchoolsPage({ searchParams }: { searchParams: SearchParams }) {
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
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Schools searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Schools({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("super.manage");
  const t = await getTranslations("schools");
  const format = await getFormatter();
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const rawStatus = one(params.status);
  const status = (SCHOOL_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as SchoolStatus) : undefined;

  const [schools, counts] = await Promise.all([listSchools({ q, status }), countSchoolsByStatus()]);

  const tabHref = (s?: SchoolStatus) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/super/schools?${qs}` : "/super/schools";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1" aria-label={t("status")}>
          {([undefined, ...SCHOOL_STATUSES] as (SchoolStatus | undefined)[]).map((s) => (
            <Link
              key={s ?? "ALL"}
              href={tabHref(s)}
              aria-current={s === status ? "page" : undefined}
              className={cn(buttonVariants({ variant: s === status ? "secondary" : "ghost", size: "sm" }))}
            >
              {s ? t(`schoolStatus.${s}`) : t("all")}
              <span className="text-muted-foreground tabular-nums">{format.number(counts[s ?? "ALL"])}</span>
            </Link>
          ))}
        </nav>
        {/* A plain GET form: the search lives in the URL, so it can be bookmarked and shared. */}
        <form action="/super/schools" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="w-56" aria-label={t("search")} />
          <Button type="submit" variant="outline" size="icon" aria-label={t("search")}>
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {schools.length === 0 ? (
        <p className="text-muted-foreground">{q || status ? t("noMatch") : t("empty")}</p>
      ) : (
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
                      <Link href={`/super/schools/${s.id}`} className="font-medium hover:underline">
                        {s.nameBn}
                      </Link>
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
                      <SchoolStatusBadge status={s.status} label={t(`schoolStatus.${s.status}`)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
