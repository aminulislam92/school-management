// GET /api/files/schools/12/logo-ab12cd.png
// A school's files are only served on that school's own site.
// The logo is public (login page, receipts); everything else needs a login.
import { getCurrentSchool } from "@/lib/tenant";
import { getCurrentUser } from "@/server/auth/dal";
import { contentTypeFor, getFileStore, isSafeKey } from "@/server/storage";

const PUBLIC_FILE = /^schools\/\d+\/logo-[a-f0-9]+\.png$/;
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!isSafeKey(key)) return notFound();

  const school = await getCurrentSchool();
  if (!school || !key.startsWith(`schools/${school.id}/`)) return notFound();

  const isPublic = PUBLIC_FILE.test(key);
  if (!isPublic && !(await getCurrentUser())) return notFound(); // don't even say it exists

  const body = await getFileStore().get(key);
  if (!body) return notFound();

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(key),
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
      // File names are random and never reused, so browsers can keep them.
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=86400",
    },
  });
}
