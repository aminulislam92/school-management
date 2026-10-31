import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { forSchool } from "@/server/db/school-db";
import { TENANT_KIND_HEADER, TENANT_VALUE_HEADER, type TenantHost } from "@/lib/tenant-host";

/** Which site this request is for, as decided by src/proxy.ts. */
export async function getTenantHost(): Promise<TenantHost> {
  const h = await headers();
  const kind = h.get(TENANT_KIND_HEADER);
  const value = h.get(TENANT_VALUE_HEADER);

  if (kind === "subdomain" && value) return { kind: "subdomain", code: value };
  if (kind === "custom" && value) return { kind: "custom", domain: value };
  return { kind: "root" };
}

const schoolSelect = {
  id: true,
  code: true,
  nameBn: true,
  nameEn: true,
  logoUrl: true,
  status: true,
  customDomain: true,
} as const;

/**
 * The school for the current request, or null on the main site / unknown host.
 * React `cache` makes repeated calls in one request hit the database once.
 */
export const getCurrentSchool = cache(async () => {
  const tenant = await getTenantHost();
  if (tenant.kind === "root") return null;

  return db.school.findUnique({
    where: tenant.kind === "subdomain" ? { code: tenant.code } : { customDomain: tenant.domain },
    select: schoolSelect,
  });
});

export type CurrentSchool = NonNullable<Awaited<ReturnType<typeof getCurrentSchool>>>;

/**
 * Use in pages and actions that only make sense inside a school.
 * Unknown school → 404. A SUSPENDED/CLOSED school has no logged-in users
 * (getSession() in dal.ts); read-only mode for expired subscriptions is T6.2.
 */
export async function requireSchool(): Promise<CurrentSchool> {
  const school = await getCurrentSchool();
  if (!school) notFound();
  return school;
}

/**
 * The current school plus a database client limited to that school.
 * Use this in every school page and action:
 *   const { school, sdb } = await getSchoolDb();
 *   const groups = await sdb.group.findMany(); // only this school's groups
 */
export const getSchoolDb = cache(async () => {
  const school = await requireSchool();
  return { school, sdb: forSchool(school.id) };
});
