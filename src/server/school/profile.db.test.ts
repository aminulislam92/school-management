// npm run test:db
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getFileStore } from "@/server/storage";
import { removeSchoolImage, SchoolProfileInput, setSchoolImage, updateSchoolProfile } from "./profile";

const run = Date.now().toString(36);
let dir: string;
let schoolId: number;
let actor: number;

const raw = (over: Record<string, string> = {}) => ({
  nameBn: "প্রোফাইল স্কুল", nameEn: "Profile School", eiin: "", board: "", phone: "", email: "",
  division: "", district: "", upazila: "", addressLine: "", ...over,
});
const files = async () => (await readdir(path.join(dir, "schools", String(schoolId))).catch(() => [])).sort();
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 4, background: "#00000000" } }).png().toBuffer();

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "profile-"));
  vi.stubEnv("STORAGE_DIR", dir); // before the first getFileStore() call
  schoolId = (await db.school.create({ data: { code: `prof-${run}`, nameBn: "পুরোনো", nameEn: "Old", levels: ["PRIMARY"] } })).id;
  actor = (await db.user.create({ data: { schoolId, email: `prof-${run}@x.test` } })).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { schoolId } });
  await db.user.deleteMany({ where: { schoolId } });
  await db.school.delete({ where: { id: schoolId } });
  await db.$disconnect();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("school profile", () => {
  it("cleans the form and checks district against division", () => {
    const ok = SchoolProfileInput.safeParse(raw({ division: "Dhaka", district: "Gazipur", phone: "+880 1712-345678" }));
    expect(ok.success && [ok.data.district, ok.data.phone, ok.data.eiin]).toEqual(["Gazipur", "01712345678", undefined]);
    expect(SchoolProfileInput.safeParse(raw({ division: "Dhaka", district: "Sylhet" })).success).toBe(false);
    expect(SchoolProfileInput.safeParse(raw({ division: "Narnia" })).success).toBe(false);
    expect(SchoolProfileInput.safeParse(raw({ district: "Old free text" })).success).toBe(true); // no division: kept
  });

  it("saves and logs only what changed", async () => {
    const first = SchoolProfileInput.parse(raw({ division: "Dhaka", district: "Gazipur", eiin: "123456" }));
    expect(await updateSchoolProfile(schoolId, first, actor)).toEqual({ changed: 5 });
    expect(await updateSchoolProfile(schoolId, first, actor)).toEqual({ changed: 0 }); // nothing new → no log
    await updateSchoolProfile(schoolId, SchoolProfileInput.parse(raw({ division: "Dhaka", district: "Gazipur" })), actor);

    const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect([school.nameBn, school.district, school.eiin]).toEqual(["প্রোফাইল স্কুল", "Gazipur", null]);
    const logs = await db.auditLog.findMany({ where: { schoolId, entity: "School" }, orderBy: { id: "asc" } });
    expect(logs).toHaveLength(2);
    expect([logs[1].before, logs[1].after]).toEqual([{ eiin: "123456" }, { eiin: null }]);
  });
});

describe("logo and signature", () => {
  it("stores a cleaned PNG, replaces the old file, and removes it", async () => {
    const a = await setSchoolImage(schoolId, "logo", await png(1200, 1200), actor);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.key).toMatch(new RegExp(`^schools/${schoolId}/logo-[a-f0-9]{12}\\.png$`));
    const stored = await getFileStore().get(a.key);
    expect((await sharp(stored!).metadata()).width).toBe(512);

    const b = await setSchoolImage(schoolId, "logo", await png(100, 100), actor);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(await files()).toEqual([b.key.split("/").pop()]); // old logo file deleted
    expect((await db.school.findUniqueOrThrow({ where: { id: schoolId } })).logoUrl).toBe(b.key);

    await removeSchoolImage(schoolId, "logo", actor);
    expect((await db.school.findUniqueOrThrow({ where: { id: schoolId } })).logoUrl).toBeNull();
    expect(await files()).toEqual([]);
  });

  it("refuses a fake image without touching the school", async () => {
    await setSchoolImage(schoolId, "signature", await png(900, 300), actor);
    const before = (await db.school.findUniqueOrThrow({ where: { id: schoolId } })).signatureUrl;
    expect(await setSchoolImage(schoolId, "signature", Buffer.from("<html>not an image"), actor)).toEqual({ ok: false, error: "notImage" });
    expect((await db.school.findUniqueOrThrow({ where: { id: schoolId } })).signatureUrl).toBe(before);
    expect(await files()).toHaveLength(1);
  });
});
