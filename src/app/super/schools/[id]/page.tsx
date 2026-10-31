import { Fragment, Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/dal";
import { getSchoolDetail, listActivePlans } from "@/server/super/schools";
import { nextSubscriptionDefaults } from "@/server/super/subscriptions";
import { PaymentForm } from "./payment-form";
import { SubscriptionForm } from "./subscription-form";
import { SchoolStatusBadge } from "../school-status-badge";
import { StatusForm } from "./status-form";

type Params = Promise<{ id: string }>;

export default function SchoolDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
      <SchoolDetail params={params} />
    </Suspense>
  );
}

async function SchoolDetail({ params }: { params: Params }) {
  await requirePermission("super.manage");
  const id = Number((await params).id);
  const school = Number.isInteger(id) && id > 0 ? await getSchoolDetail(id) : null;
  if (!school) notFound();

  const [t, ts, tp, plans, next] = await Promise.all([
    getTranslations("schools"),
    getTranslations("subs"),
    getTranslations("plans"),
    listActivePlans(),
    nextSubscriptionDefaults(school.id),
  ]);
  const format = await getFormatter();
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium" });
  const taka = (n: number | string) => format.number(Number(n), { style: "currency", currency: "BDT" });
  const h = await headers();
  const host = (h.get("host") ?? "localhost:3000").replace(/^www\./, "");
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const siteUrl = school.customDomain ? `https://${school.customDomain}` : `${proto}://${school.code}.${host}`;

  const info: [string, React.ReactNode][] = [
    [t("fields.nameEn"), school.nameEn],
    [t("fields.code"), <span key="c" className="font-mono">{school.code}</span>],
    [t("customDomain"), school.customDomain ?? "—"],
    [t("fields.eiin"), school.eiin ?? "—"],
    [t("fields.board"), school.board ? t(`boards.${school.board}`) : "—"],
    [t("fields.levels"), school.levels.map((l) => t(`levels.${l}`)).join(", ")],
    [t("fields.phone"), school.phone ?? "—"],
    [t("fields.email"), school.email ?? "—"],
    [t("address"), [school.upazila, school.district].filter(Boolean).join(", ") || "—"],
    [t("createdAt"), date(school.createdAt)],
  ];

  const stats: [string, number][] = [
    [t("students"), school._count.students],
    [t("staffCount"), school._count.staff],
    [t("classCount"), school._count.classes],
    [t("userCount"), school._count.users],
    [t("smsCredits"), school.setting?.smsCreditBalance ?? 0],
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/super/schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-4" />
          {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{school.nameBn}</h1>
          <SchoolStatusBadge status={school.status} label={t(`schoolStatus.${school.status}`)} />
          <a href={`${siteUrl}/login`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink className="size-4" />
            {t("openSite")}
          </a>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(n)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("sections.school")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {info.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admins")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {school.admins.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{a.staff?.nameBn ?? a.staff?.nameEn ?? "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{a.email ?? a.phone}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!a.isActive && <Badge variant="outline">{t("adminInactive")}</Badge>}
                    {a.mustChangePassword && <Badge variant="outline">{t("adminTempPassword")}</Badge>}
                    <Badge variant="secondary" className="font-normal">
                      {a.lastLoginAt ? t("lastLogin", { date: date(a.lastLoginAt) }) : t("neverLoggedIn")}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("subscriptionHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {school.subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSubscriptions")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fields.plan")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("period")}</TableHead>
                        <TableHead className="text-right">{t("paid")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {school.subscriptions.map((s) => (
                        <Fragment key={s.id}>
                          <TableRow className={s.status === "CANCELLED" ? "text-muted-foreground" : undefined}>
                            <TableCell>{s.plan.name}</TableCell>
                            <TableCell>{t(`subStatus.${s.status}`)}</TableCell>
                            <TableCell className="text-sm">
                              {date(s.startsAt)} – {date(s.endsAt)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{taka(s.paid.toString())}</TableCell>
                          </TableRow>
                          {s.payments.map((p) => (
                            <TableRow key={`p${p.id}`} className="border-0 text-xs text-muted-foreground">
                              <TableCell colSpan={3} className="py-1 pl-6">
                                {date(p.paidAt)} · {ts(`methods.${p.method}`)}
                                {p.trxId && <span className="font-mono"> · {p.trxId}</span>}
                                {p.note && <> · {p.note}</>}
                              </TableCell>
                              <TableCell className="py-1 text-right tabular-nums">{taka(p.amount.toString())}</TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{ts("newSubscription")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SubscriptionForm
                schoolId={school.id}
                startsOn={next.startsOn}
                planId={next.planId}
                plans={plans.map((p) => ({
                  id: p.id,
                  cycle: p.billingCycle,
                  label: `${p.name} — ${taka(p.price.toString())} / ${tp(`per.${p.billingCycle}`)}`,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{ts("payment")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentForm
                schoolId={school.id}
                today={next.today}
                subscriptions={school.subscriptions
                  .filter((s) => s.status !== "CANCELLED")
                  .map((s) => ({
                    id: s.id,
                    price: s.plan.price.toString(),
                    label: `${s.plan.name} · ${date(s.startsAt)} – ${date(s.endsAt)}`,
                  }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("changeStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusForm id={school.id} current={school.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              {school.history.length === 0 && <p className="text-sm text-muted-foreground">{t("noHistory")}</p>}
              <ol id="school-history" className="space-y-3 text-sm">
                {school.history.map((h) => {
                  const after = (h.after ?? {}) as { status?: string; reason?: string | null };
                  return (
                    <li key={h.id} className="border-l-2 pl-3">
                      <div className="font-medium">
                        {h.action === "STATUS" && after.status
                          ? t("historyStatus", { status: t(`schoolStatus.${after.status}`) })
                          : t(`historyAction.${h.action === "CREATE" ? "CREATE" : "OTHER"}`)}
                      </div>
                      {after.reason && <div className="text-muted-foreground">{after.reason}</div>}
                      <div className="text-xs text-muted-foreground">
                        {format.dateTime(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                        {h.user?.email ? ` · ${h.user.email}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
