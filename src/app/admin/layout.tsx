import { getLocale } from "next-intl/server";
import { School } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentSchool } from "@/lib/tenant";
import { NAV } from "./_nav/nav-items";

// School panel frame. The shared shell is in src/components/shell/app-shell.tsx.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} icon={<School className="size-5 shrink-0" />} Brand={SchoolName}>
      {children}
    </AppShell>
  );
}

async function SchoolName({ className }: { className?: string }) {
  const school = await getCurrentSchool();
  if (!school) return null;
  const locale = await getLocale();
  return <span className={className}>{locale === "bn" ? school.nameBn : school.nameEn}</span>;
}
