import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/shell/section-tabs";

// Classes, sections, subjects ... get their tabs in T1.17–T1.21.
export default async function AcademicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("academicTabs");
  return (
    <div className="space-y-6">
      <SectionTabs label={t("label")} tabs={[{ href: "/admin/academic/sessions", label: t("sessions") }]} />
      {children}
    </div>
  );
}
