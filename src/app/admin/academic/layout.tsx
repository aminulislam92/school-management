import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/shell/section-tabs";

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
          { href: "/admin/academic/subjects", label: t("subjects") },
          { href: "/admin/academic/class-subjects", label: t("classSubjects") },
          { href: "/admin/academic/holidays", label: t("holidays") },
        ]}
      />
      {children}
    </div>
  );
}
