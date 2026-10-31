// The frame shared by the panels: sidebar menu, header, content.
// No auth check here on purpose (layouts don't re-run on navigation): every
// page calls requireUser()/requirePermission() itself. The shell only reads
// the user to build the menu, each piece in its own Suspense.
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/dal";
import { MobileNav, NavLinks, type NavLinkGroup } from "./nav-links";
import { filterNav, type NavGroup } from "./nav-types";
import { UserMenu } from "./user-menu";

type BrandProps = { className?: string };

export function AppShell({
  nav,
  icon,
  Brand,
  children,
}: {
  nav: NavGroup[];
  icon: React.ReactNode;
  /** Name shown at the top of the sidebar and in the phone header (may be async). */
  Brand: (props: BrandProps) => React.ReactNode | Promise<React.ReactNode>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          {icon}
          <Suspense fallback={<Skeleton className="h-4 w-32" />}>
            <Brand className="truncate text-sm font-semibold" />
          </Suspense>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav nav={nav} />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-3 md:px-6">
          <Suspense fallback={null}>
            <MobileMenu nav={nav} title={<Brand />} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-4 w-40 md:hidden" />}>
            <Brand className="truncate font-semibold md:hidden" />
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

/** Menu groups for the current user, with labels already translated. */
async function menuGroups(nav: NavGroup[]): Promise<NavLinkGroup[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("nav");
  return filterNav(nav, user.roles).map((group) => ({
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

async function SidebarNav({ nav }: { nav: NavGroup[] }) {
  const groups = await menuGroups(nav);
  if (!groups) return null;
  const t = await getTranslations("nav");
  return <NavLinks groups={groups} soonLabel={t("soon")} />;
}

async function MobileMenu({ nav, title }: { nav: NavGroup[]; title: React.ReactNode }) {
  const groups = await menuGroups(nav);
  if (!groups) return null;
  const t = await getTranslations("nav");
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
      changePasswordLabel={t("changePassword.menuItem")}
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
