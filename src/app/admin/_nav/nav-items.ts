// The school panel menu. Each item shows only for users with its permission.
// `ready: false` items are listed but not clickable yet ("coming soon");
// switch them to true as each page is built.
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
  | "audit";

export type NavItem = {
  key: string; // translation key under "nav.items"
  href: string;
  icon: NavIcon;
  permission: Permission | null; // null = every staff member
  ready: boolean;
};

export type NavGroup = { key: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    key: "main",
    items: [{ key: "dashboard", href: "/admin", icon: "home", permission: null, ready: true }],
  },
  {
    key: "daily",
    items: [
      { key: "students", href: "/admin/students", icon: "students", permission: "student.read", ready: false },
      { key: "attendance", href: "/admin/attendance", icon: "attendance", permission: "attendance.take", ready: false },
      { key: "collectFees", href: "/admin/fees/collect", icon: "fees", permission: "fee.collect", ready: false },
      { key: "marks", href: "/admin/marks", icon: "marks", permission: "marks.enter", ready: false },
      { key: "notices", href: "/admin/notices", icon: "notices", permission: "notice.manage", ready: false },
      { key: "sms", href: "/admin/sms/send", icon: "sms", permission: "sms.send", ready: false },
    ],
  },
  {
    key: "records",
    items: [
      { key: "exams", href: "/admin/exams", icon: "exams", permission: "exam.manage", ready: false },
      { key: "results", href: "/admin/results", icon: "results", permission: "result.review", ready: false },
      { key: "financeReports", href: "/admin/fees/reports", icon: "reports", permission: "report.finance", ready: false },
      { key: "expenses", href: "/admin/expenses", icon: "expenses", permission: "expense.manage", ready: false },
    ],
  },
  {
    key: "setup",
    items: [
      { key: "academic", href: "/admin/academic/sessions", icon: "academic", permission: "academic.manage", ready: false },
      { key: "feeSetup", href: "/admin/fees/types", icon: "feeSetup", permission: "fee.setup", ready: false },
      { key: "staff", href: "/admin/staff", icon: "staff", permission: "staff.manage", ready: false },
      { key: "users", href: "/admin/users", icon: "users", permission: "user.manage", ready: false },
      { key: "settings", href: "/admin/settings/school", icon: "settings", permission: "settings.manage", ready: false },
      { key: "auditLog", href: "/admin/audit-logs", icon: "audit", permission: "audit.read", ready: false },
    ],
  },
];

/** The menu for these roles: hidden items removed, empty groups dropped. */
export function navFor(roles: readonly Role[]): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.permission === null || can(roles, item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Which item is "current" for a URL: the longest matching href wins. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
