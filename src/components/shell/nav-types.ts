// Menu data shared by every panel (/admin, /super, later /portal).
// Pure TypeScript, so it is unit-testable.
import type { Role } from "@prisma/client";
import { can, type Permission } from "@/server/auth/permissions";

export type NavIcon =
  | "home"
  | "students"
  | "attendance"
  | "fees"
  | "feeSetup"
  | "reports"
  | "expenses"
  | "exams"
  | "marks"
  | "results"
  | "notices"
  | "sms"
  | "staff"
  | "users"
  | "academic"
  | "settings"
  | "audit"
  | "schools"
  | "plans"
  | "subscriptions";

export type NavItem = {
  key: string; // translation key under "nav.items"
  href: string;
  icon: NavIcon;
  permission: Permission | null; // null = everyone who can open this panel
  ready: boolean; // false = shown as "coming soon", not clickable
};

export type NavGroup = { key: string; items: NavItem[] };

/** The menu for these roles: hidden items removed, empty groups dropped. */
export function filterNav(nav: NavGroup[], roles: readonly Role[]): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.permission === null || can(roles, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Which item is "current" for a URL: the longest matching href wins. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
