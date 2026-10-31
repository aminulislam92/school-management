import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/dal";
import { listSubscriptionWatch } from "@/server/super/subscriptions";

const WATCH_DAYS = 30;

export default async function SubscriptionsPage() {
  const t = await getTranslations("subs");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("watchTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("watchHint", { days: WATCH_DAYS })}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <Watch />
      </Suspense>
    </div>
  );
}

async function Watch() {
  await requirePermission("super.manage");
  await connection(); // uses the current time
  const t = await getTranslations("subs");
  const tsch = await getTranslations("schools");
  const format = await getFormatter();
  const rows = await listSubscriptionWatch(WATCH_DAYS);

  if (rows.length === 0) return <p className="text-muted-foreground">{t("watchEmpty")}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tsch("fields.nameBn")}</TableHead>
            <TableHead>{t("plan")}</TableHead>
            <TableHead>{tsch("status")}</TableHead>
            <TableHead>{t("endsOn")}</TableHead>
            <TableHead className="text-right">{t("daysLeft")}</TableHead>
            <TableHead className="text-right">{tsch("paid")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link href={`/super/schools/${r.id}`} className="font-medium hover:underline">
                  {r.nameBn}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
              </TableCell>
              <TableCell>{r.sub?.plan.name ?? "—"}</TableCell>
              <TableCell>{r.sub ? tsch(`subStatus.${r.sub.status}`) : t("noSub")}</TableCell>
              <TableCell className="text-sm">{r.sub ? format.dateTime(r.sub.endsAt, { dateStyle: "medium" }) : "—"}</TableCell>
              <TableCell className="text-right">
                {r.sub &&
                  (r.sub.daysLeft > 0 ? (
                    <Badge variant={r.sub.daysLeft <= 7 ? "destructive" : "secondary"}>{t("daysLeftValue", { days: r.sub.daysLeft })}</Badge>
                  ) : (
                    <Badge variant="destructive">{t("expired")}</Badge>
                  ))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.sub ? format.number(Number(r.sub.paid.toString()), { style: "currency", currency: "BDT" }) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
