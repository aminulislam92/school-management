// School profile, logo and head teacher's signature (school ADMIN).
// `School` is a global table (it IS the school), so this uses the plain `db`,
// always with the schoolId of the site being visited — never one from a form.
import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getFileStore } from "@/server/storage";
import { cleanImage, type ImageKind } from "@/server/storage/images";
import { PROFILE_FIELDS, type SchoolProfileInput } from "./profile-schema";

export * from "./profile-schema";

const FIELD: Record<ImageKind, "logoUrl" | "signatureUrl"> = { logo: "logoUrl", signature: "signatureUrl" };

const profileSelect = {
  code: true,
  customDomain: true,
  logoUrl: true,
  signatureUrl: true,
  nameBn: true,
  nameEn: true,
  eiin: true,
  board: true,
  phone: true,
  email: true,
  division: true,
  district: true,
  upazila: true,
  addressLine: true,
} as const;

export function getSchoolProfile(schoolId: number) {
  return db.school.findUniqueOrThrow({ where: { id: schoolId }, select: profileSelect });
}

export async function updateSchoolProfile(schoolId: number, input: SchoolProfileInput, actorId: number) {
  const before = await getSchoolProfile(schoolId);
  // An empty box clears the value (undefined → null).
  const data = {
    nameBn: input.nameBn,
    nameEn: input.nameEn,
    eiin: input.eiin ?? null,
    board: input.board ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    division: input.division ?? null,
    district: input.district ?? null,
    upazila: input.upazila ?? null,
    addressLine: input.addressLine ?? null,
  };

  // Only log what really changed.
  const changed = PROFILE_FIELDS.filter((f) => before[f] !== data[f]);
  if (changed.length === 0) return { changed: 0 };

  await db.$transaction([
    db.school.update({ where: { id: schoolId }, data }),
    db.auditLog.create({
      data: {
        schoolId,
        userId: actorId,
        action: "UPDATE",
        entity: "School",
        entityId: String(schoolId),
        before: Object.fromEntries(changed.map((f) => [f, before[f]])),
        after: Object.fromEntries(changed.map((f) => [f, data[f]])),
      },
    }),
  ]);
  return { changed: changed.length };
}

/** The stored file key of the logo or signature. */
async function currentImageKey(schoolId: number, kind: ImageKind) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { logoUrl: true, signatureUrl: true } });
  return kind === "logo" ? school.logoUrl : school.signatureUrl;
}

export type ImageSaveResult = { ok: true; key: string } | { ok: false; error: "tooBig" | "notImage" };

/** Cleans and stores a new logo/signature, then removes the old file. */
export async function setSchoolImage(schoolId: number, kind: ImageKind, upload: Buffer, actorId: number): Promise<ImageSaveResult> {
  const cleaned = await cleanImage(upload, kind);
  if (!cleaned.ok) return cleaned;

  const store = getFileStore();
  // A new random name each time: browsers may cache the old picture forever.
  const key = `schools/${schoolId}/${kind}-${randomBytes(6).toString("hex")}.png`;
  await store.put(key, cleaned.png);

  const field = FIELD[kind];
  try {
    const oldKey = await currentImageKey(schoolId, kind);
    await db.$transaction([
      db.school.update({ where: { id: schoolId }, data: { [field]: key } }),
      db.auditLog.create({
        data: { schoolId, userId: actorId, action: "UPDATE", entity: "School", entityId: String(schoolId), before: { [field]: oldKey }, after: { [field]: key } },
      }),
    ]);
    if (oldKey) await store.delete(oldKey).catch(() => {}); // a leftover file is harmless
  } catch (e) {
    await store.delete(key).catch(() => {}); // the database didn't take it: don't keep the file
    throw e;
  }
  return { ok: true, key };
}

export async function removeSchoolImage(schoolId: number, kind: ImageKind, actorId: number) {
  const field = FIELD[kind];
  const oldKey = await currentImageKey(schoolId, kind);
  if (!oldKey) return;
  await db.$transaction([
    db.school.update({ where: { id: schoolId }, data: { [field]: null } }),
    db.auditLog.create({
      data: { schoolId, userId: actorId, action: "UPDATE", entity: "School", entityId: String(schoolId), before: { [field]: oldKey }, after: { [field]: null } },
    }),
  ]);
  await getFileStore().delete(oldKey).catch(() => {});
}
