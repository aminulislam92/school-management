"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  Coins,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  PenLine,
  Receipt,
  Settings,
  Trophy,
  UserCog,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeHref, type NavIcon } from "./nav-items";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: LayoutDashboard,
  students: Users,
  attendance: CalendarCheck,
  fees: Wallet,
  feeSetup: Coins,
  reports: ChartColumn,
  expenses: Receipt,
  exams: ClipboardList,
  marks: PenLine,
  results: Trophy,
  notices: Megaphone,
  sms: MessageSquare,
  staff: UserCog,
  users: UserRound,
  academic: GraduationCap,
  settings: Settings,
  audit: History,
};

// Labels are translated on the server and passed in as plain strings.
export type NavLinkGroup = {
  key: string;
  label: string;
  items: { href: string; icon: NavIcon; label: string; ready: boolean }[];
};

export function NavLinks({
  groups,
  soonLabel,
  onNavigate,
}: {
  groups: NavLinkGroup[];
  soonLabel: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = activeHref(
    pathname,
    groups.flatMap((g) => g.items.filter((i) => i.ready).map((i) => i.href)),
  );

  return (
    <nav className="flex flex-col gap-4 p-3" aria-label="Main">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {group.key !== "main" && (
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
          )}
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const base = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";

            if (!item.ready) {
              return (
                <span key={item.href} className={cn(base, "cursor-not-allowed text-muted-foreground/60")} aria-disabled>
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px]">{soonLabel}</span>
                </span>
              );
            }

            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent font-medium text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Hamburger button + slide-in menu for phones (hidden on md and up). */
export function MobileNav({
  groups,
  soonLabel,
  title,
  openLabel,
}: {
  groups: NavLinkGroup[];
  soonLabel: string;
  title: string;
  openLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={openLabel} />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <NavLinks groups={groups} soonLabel={soonLabel} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
