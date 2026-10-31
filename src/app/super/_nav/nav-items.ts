// The super admin menu (main site only). Every item needs "super.manage".
// `ready: false` items show as "coming soon" until their task is done.
import type { NavGroup } from "@/components/shell/nav-types";

export const SUPER_NAV: NavGroup[] = [
  {
    key: "main",
    items: [{ key: "superDashboard", href: "/super", icon: "home", permission: "super.manage", ready: true }],
  },
  {
    key: "saas",
    items: [
      { key: "schools", href: "/super/schools", icon: "schools", permission: "super.manage", ready: true },
      { key: "plans", href: "/super/plans", icon: "plans", permission: "super.manage", ready: true },
      { key: "subscriptions", href: "/super/subscriptions", icon: "subscriptions", permission: "super.manage", ready: true },
    ],
  },
];
