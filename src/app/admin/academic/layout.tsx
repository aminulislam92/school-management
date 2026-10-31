import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/shell/section-tabs";

// Subjects, class subjects and holidays get their tabs in T1.19–T1.21.
export default async function AcademicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("academicTabs");
  return (
    <div className="space-y-6">
      <SectionTabs
        label={t("label")}
        tabs={[
          { href: "/admin/academic/sessions", label: t("sessions") },
          { href: "/admin/academic/classes", label: t("classes") },
          { href: "/admin/academic/groups", label: t("groups") },
          { href: "/admin/academic/sections", label: t("sections") },
        ]}
      />
      {children}
    </div>
  );
}
