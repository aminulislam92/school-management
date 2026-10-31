// The school panel menu. Each item shows only for users with its permission.
// `ready: false` items are listed but not clickable yet ("coming soon");
// switch them to true as each page is built. Types: src/components/shell/nav-types.ts
import type { Role } from "@prisma/client";
import { filterNav, type NavGroup } from "@/components/shell/nav-types";

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

/** The school panel menu for these roles. */
export function navFor(roles: readonly Role[]): NavGroup[] {
  return filterNav(NAV, roles);
}
