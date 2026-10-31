import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { School } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSchool } from "@/lib/tenant";
import { getCurrentUser } from "@/server/auth/dal";
import { navFor } from "./_nav/nav-items";
import { MobileNav, NavLinks, type NavLinkGroup } from "./_nav/nav-links";
import { UserMenu } from "./_nav/user-menu";

// The school panel frame: sidebar menu, header, content.
// No auth check here on purpose (layouts don't re-run on navigation): every
// page calls requireUser()/requirePermission() itself. The layout only reads
// the user to build the menu, each piece in its own Suspense.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <School className="size-5 shrink-0" />
          <Suspense fallback={<Skeleton className="h-4 w-32" />}>
            <SchoolName className="truncate text-sm font-semibold" />
          </Suspense>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-3 md:px-6">
          <Suspense fallback={null}>
            <MobileMenu />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-4 w-40 md:hidden" />}>
            <SchoolName className="truncate font-semibold md:hidden" />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <Suspense fallback={<Skeleton className="h-8 w-24" />}>
              <HeaderUser />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

async function SchoolName({ className }: { className?: string }) {
  const school = await getCurrentSchool();
  if (!school) return null;
  const locale = await getLocale();
  return <span className={className}>{locale === "bn" ? school.nameBn : school.nameEn}</span>;
}

/** Menu groups for the current user, with labels already translated. */
async function menuGroups(): Promise<NavLinkGroup[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("nav");
  return navFor(user.roles).map((group) => ({
    key: group.key,
    label: t(`groups.${group.key}`),
    items: group.items.map((item) => ({
      href: item.href,
      icon: item.icon,
      ready: item.ready,
      label: t(`items.${item.key}`),
    })),
  }));
}

async function SidebarNav() {
  const groups = await menuGroups();
  if (!groups) return null;
  const t = await getTranslations("nav");
  return <NavLinks groups={groups} soonLabel={t("soon")} />;
}

async function MobileMenu() {
  const groups = await menuGroups();
  if (!groups) return null;
  const t = await getTranslations("nav");
  const school = await getCurrentSchool();
  const locale = await getLocale();
  const title = school ? (locale === "bn" ? school.nameBn : school.nameEn) : "";
  return <MobileNav groups={groups} soonLabel={t("soon")} title={title} openLabel={t("openMenu")} />;
}

async function HeaderUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <UserMenu
      name={(locale === "bn" && user.nameBn) || user.nameEn}
      roleLabels={user.roles.map((r) => t(`roles.${r}`))}
      signOutLabel={t("auth.signOut")}
    />
  );
}

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
