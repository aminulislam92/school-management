// Works out which school a request is for, from its Host header only.
// Pure function (no database) so it can run in proxy.ts and be unit-tested.

// Request headers set by src/proxy.ts and read by src/lib/tenant.ts.
export const TENANT_KIND_HEADER = "x-tenant-kind";
export const TENANT_VALUE_HEADER = "x-tenant-value";

export type TenantHost =
  | { kind: "root" } // yourapp.com, www.yourapp.com — product site and /super
  | { kind: "subdomain"; code: string } // demo.yourapp.com
  | { kind: "custom"; domain: string }; // abcschool.edu.bd

// Subdomains that never belong to a school.
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "app",
  "api",
  "super",
  "mail",
  "static",
  "cdn",
]);

// Same rule as School.code: lowercase letters, digits and hyphens, 2–40 chars.
const SCHOOL_CODE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function stripPort(host: string): string {
  // IPv6 hosts look like [::1]:3000
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.split(":")[0];
}

export function normalizeHost(host: string): string {
  return stripPort(host.trim().toLowerCase()).replace(/\.$/, "");
}

export function isValidSchoolCode(code: string): boolean {
  return code.length >= 2 && SCHOOL_CODE.test(code) && !RESERVED_SUBDOMAINS.has(code);
}

/**
 * @param host       raw Host header, e.g. "demo.localhost:3000"
 * @param rootDomain the app's own domain without port, e.g. "yourapp.com" or "localhost"
 */
export function resolveTenantHost(host: string | null | undefined, rootDomain: string): TenantHost {
  const root = normalizeHost(rootDomain);
  const h = normalizeHost(host ?? "");

  if (!h || h === root || h === `www.${root}`) return { kind: "root" };

  // Plain IP addresses (e.g. opening the dev server from a phone) count as root.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.startsWith("[")) return { kind: "root" };

  if (h.endsWith(`.${root}`)) {
    const sub = h.slice(0, -(root.length + 1));
    // Only one level: "demo.yourapp.com" yes, "a.b.yourapp.com" no.
    if (!sub.includes(".") && isValidSchoolCode(sub)) return { kind: "subdomain", code: sub };
    return { kind: "root" };
  }

  return { kind: "custom", domain: h.replace(/^www\./, "") };
}
