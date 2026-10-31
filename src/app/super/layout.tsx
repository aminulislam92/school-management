import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { SUPER_NAV } from "./_nav/nav-items";

// Super admin panel frame (main site only; proxy.ts blocks /super on school sites).
export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={SUPER_NAV} icon={<ShieldCheck className="size-5 shrink-0" />} Brand={SuperBrand}>
      {children}
    </AppShell>
  );
}

async function SuperBrand({ className }: { className?: string }) {
  const t = await getTranslations("super");
  return <span className={className}>{t("brand")}</span>;
}
