import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateOnly, toDhakaYmd } from "@/lib/dates";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { setCurrentSessionAction } from "@/server/academic/session-actions";
import { listSessions, nextSessionSuggestions, SESSION_TYPES, type SessionRow } from "@/server/academic/sessions";
import { DeleteSessionButton } from "./delete-session-button";
import { SessionForm } from "./session-form";

export default async function SessionsPage() {
  const t = await getTranslations("sessions");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-5xl" />}>
        <Sessions />
      </Suspense>
    </div>
  );
}

async function Sessions() {
  await requirePermission("academic.manage");
  await connection(); // "today" for the suggestion below
  const { school, sdb } = await getSchoolDb();
  const t = await getTranslations("sessions");
  const format = await getFormatter();
  const [rows, levels, suggest] = await Promise.all([
    listSessions(sdb),
    db.school.findUniqueOrThrow({ where: { id: school.id }, select: { levels: true } }).then((s) => s.levels as string[]),
    nextSessionSuggestions(sdb, toDhakaYmd(new Date())),
  ]);
  const hasCollege = levels.includes("HIGHER_SECONDARY");
  const types = SESSION_TYPES.filter((type) => type === "SCHOOL" || hasCollege || rows.some((r) => r.type === type));
  // Date-only values are UTC midnight; show them in UTC so the day never shifts.
  const day = (ymd: string) => format.dateTime(dateOnly(ymd), { dateStyle: "medium", timeZone: "UTC" });

  const table = (list: SessionRow[]) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.name")}</TableHead>
              <TableHead>{t("period")}</TableHead>
              <TableHead className="text-right">{t("students")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id} data-session={s.name}>
                <TableCell className="font-medium">
                  {s.name} {s.isCurrent && <Badge className="ml-1">{t("current")}</Badge>}
                </TableCell>
                <TableCell className="text-sm">
                  {day(s.startDate)} – {day(s.endDate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{format.number(s.students)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!s.isCurrent && (
                      <form action={setCurrentSessionAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {t("makeCurrent")}
                        </Button>
                      </form>
                    )}
                    <Link href={`/admin/academic/sessions/${s.id}/edit`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {t("edit")}
                    </Link>
                    {!s.isCurrent && !s.inUse && <DeleteSessionButton id={s.id} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {types.map((type) => (
          <Card key={type} id={`sessions-${type}`}>
            <CardHeader>
              <CardTitle>{t(`types.${type}`)}</CardTitle>
              <CardDescription>{t(`typeHints.${type}`)}</CardDescription>
            </CardHeader>
            <CardContent>{table(rows.filter((r) => r.type === type))}</CardContent>
          </Card>
        ))}
        <p className="text-xs text-muted-foreground">{t("currentNote")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionForm types={types} suggest={suggest} />
        </CardContent>
      </Card>
    </div>
  );
}
