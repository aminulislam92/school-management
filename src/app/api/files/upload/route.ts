// POST /api/files/upload — multipart form: `kind` + `file`.
// Today: the school logo and the head teacher's signature (ADMIN only).
// Later kinds (student photos, attachments) add a line to KINDS.
import { getCurrentSchool } from "@/lib/tenant";
import { getCurrentUser } from "@/server/auth/dal";
import { can, type Permission } from "@/server/auth/permissions";
import { setSchoolImage } from "@/server/school/profile";
import { fileUrl } from "@/server/storage";
import { MAX_UPLOAD_BYTES, type ImageKind } from "@/server/storage/images";

const KINDS: Record<ImageKind, Permission> = {
  logo: "settings.manage",
  signature: "settings.manage",
};

const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  // Only our own pages may upload (extra guard on top of the SameSite cookie).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return fail("forbidden", 403);

  const school = await getCurrentSchool();
  if (!school) return fail("notFound", 404);
  const user = await getCurrentUser(); // also checks the user belongs to this school and it's ACTIVE
  if (!user || user.mustChangePassword) return fail("login", 401);

  // Refuse big bodies before reading them into memory.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return fail("tooBig", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("badRequest", 400);
  }
  const kind = String(form.get("kind") ?? "") as ImageKind;
  if (!(kind in KINDS)) return fail("badRequest", 400);
  if (!can(user.roles, KINDS[kind])) return fail("forbidden", 403);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("noFile", 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail("tooBig", 413);

  const result = await setSchoolImage(school.id, kind, Buffer.from(await file.arrayBuffer()), user.id);
  if (!result.ok) return fail(result.error, 400);
  return Response.json({ ok: true, url: fileUrl(result.key) });
}
