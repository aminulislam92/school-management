import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "cn";
import { dateOnly, toDhakaYmd } from "@/lib/dates";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { deleteHolidayAction } from "@/server/academic/holiday-actions";
import { holidayYears, listHolidays } from "@/server/academic/holidays";
import { getGeneralSettings } from "@/server/school/settings";
import { RowActionButton } from "../_components/row-action-button";
import { HolidayForm } from "./holiday-form";

type SearchParams = Promise<{ year?: string | string[] }>;

export default async function HolidaysPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("holidays");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-5xl" />}>
        <Holidays searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Holidays({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("academic.manage");
  await connection(); // "this year" needs today's date
  const { school, sdb } = await getSchoolDb();
  const t = await getTranslations("holidays");
  const td = await getTranslations("generalSettings.days");
  const format = await getFormatter();

  const thisYear = Number(toDhakaYmd(new Date()).slice(0, 4));
  const asked = Number((await searchParams).year);
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : thisYear;
  const [ranges, years, { setting }] = await Promise.all([listHolidays(sdb, year), holidayYears(sdb), getGeneralSettings(sdb, school.id)]);
  const tabs = [...new Set([...years, thisYear, thisYear + 1, year])].sort();
  const total = ranges.reduce((n, r) => n + r.days, 0);
  const day = (ymd: string) => format.dateTime(dateOnly(ymd), { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        <nav aria-label={t("year")} className="flex flex-wrap gap-1">
          {tabs.map((y) => (
            <Link key={y} href={`/admin/academic/holidays?year=${y}`} aria-current={y === year ? "page" : undefined} className={cn(buttonVariants({ variant: y === year ? "secondary" : "ghost", size: "sm" }))}>
              {format.number(y, { useGrouping: false })}
            </Link>
          ))}
        </nav>
        <p className="text-sm">
          {t("summary", { days: total, year: format.number(year, { useGrouping: false }) })}{" "}
          <span className="text-muted-foreground">
            {t("weekly", { days: setting.weeklyHolidays.map((d) => td(d)).join(", ") || t("none") })}{" "}
            <Link href="/admin/settings/general" className="underline">
              {t("changeWeekly")}
            </Link>
          </span>
        </p>
        {ranges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleField")}</TableHead>
                  <TableHead>{t("dates")}</TableHead>
                  <TableHead className="text-right">{t("days")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranges.map((r) => (
                  <TableRow key={`${r.from}-${r.title}`} data-holiday={r.from}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-sm">{r.days === 1 ? day(r.from) : `${day(r.from)} – ${day(r.to)}`}</TableCell>
                    <TableCell className="text-right tabular-nums">{format.number(r.days)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <RowActionButton action={deleteHolidayAction} fields={{ from: r.from, to: r.to, title: r.title }} label={t("delete")} confirmLabel={t("confirmDelete")} />
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
          <HolidayForm />
        </CardContent>
      </Card>
    </div>
  );
}
