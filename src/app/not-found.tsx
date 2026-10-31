import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

// Shown for unknown schools (e.g. wrong.localhost:3000) and missing pages.
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("description")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("back")}
      </Link>
    </main>
  );
}
