"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeSchoolImageAction } from "@/server/school/profile-actions";

const MAX_MB = 5;

export function ImageUpload({ kind, url }: { kind: "logo" | "signature"; url: string | null }) {
  const t = useTranslations("schoolProfile.upload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError("tooBig"); // save the user a slow upload
    setBusy(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) return setError(data.error ?? "failed");
      router.refresh(); // reload the page data from the server: shows the new picture
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`${kind}.title`)}</CardTitle>
        <CardDescription>{t(`${kind}.hint`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own small, already-resized file
            <img id={`${kind}-preview`} src={url} alt={t(`${kind}.title`)} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">{t("empty")}</span>
          )}
        </div>
        <input
          ref={input}
          id={`${kind}-file`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ImageUp className="size-4" />
            {busy ? t("uploading") : url ? t("change") : t("choose")}
          </Button>
          {url && (
            <form action={removeSchoolImageAction}>
              <input type="hidden" name="kind" value={kind} />
              <Button type="submit" variant="ghost" size="sm" disabled={busy}>
                <Trash2 className="size-4" />
                {t("remove")}
              </Button>
            </form>
          )}
        </div>
        {error && (
          <p id={`${kind}-error`} role="alert" className="text-sm text-destructive">
            {t(`errors.${error}`, { mb: MAX_MB })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("formats", { mb: MAX_MB })}</p>
      </CardContent>
    </Card>
  );
}
