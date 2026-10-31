import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolDb } from "@/lib/tenant";
import { requirePermission } from "@/server/auth/dal";
import { getSchoolProfile } from "@/server/school/profile";
import { fileUrl } from "@/server/storage";
import { ImageUpload } from "./image-upload";
import { ProfileForm } from "./profile-form";

export default async function SchoolProfilePage() {
  const t = await getTranslations("schoolProfile");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem] w-full max-w-4xl" />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  await requirePermission("settings.manage");
  const { school } = await getSchoolDb();
  const t = await getTranslations("schoolProfile");
  const profile = await getSchoolProfile(school.id);

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
          <CardDescription>
            {t("codeNote", { code: profile.code })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              nameBn: profile.nameBn,
              nameEn: profile.nameEn,
              eiin: profile.eiin ?? "",
              board: profile.board ?? "",
              phone: profile.phone ?? "",
              email: profile.email ?? "",
              division: profile.division ?? "",
              district: profile.district ?? "",
              upazila: profile.upazila ?? "",
              addressLine: profile.addressLine ?? "",
            }}
          />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <ImageUpload kind="logo" url={fileUrl(profile.logoUrl)} />
        <ImageUpload kind="signature" url={fileUrl(profile.signatureUrl)} />
      </div>
    </div>
  );
}
