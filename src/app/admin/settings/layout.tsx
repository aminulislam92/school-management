import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/shell/section-tabs";

// More tabs (SMS, grade scales, late fees) are added as their tasks are done.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settingsTabs");
  return (
    <div className="space-y-6">
      <SectionTabs
        label={t("label")}
        tabs={[
          { href: "/admin/settings/school", label: t("school") },
          { href: "/admin/settings/general", label: t("general") },
        ]}
      />
      {children}
    </div>
  );
}
