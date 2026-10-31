"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "cn";

// More tabs (SMS, grade scales, late fees) are added as their tasks are done.
const TABS = [
  { href: "/admin/settings/school", key: "school" },
  { href: "/admin/settings/general", key: "general" },
] as const;

export function SettingsTabs() {
  const t = useTranslations("settingsTabs");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
