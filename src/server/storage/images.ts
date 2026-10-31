// Cleans an uploaded image before we store it:
// - checks the real file type from its content (not the name or the browser's word),
// - shrinks big phone photos, and fixes rotation from the camera,
// - drops hidden data (GPS location, camera details) by re-encoding,
// - saves as PNG (keeps a transparent logo/signature background).
import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB before processing

export const IMAGE_SIZES = {
  logo: { width: 512, height: 512 },
  signature: { width: 600, height: 240 },
} as const;
export type ImageKind = keyof typeof IMAGE_SIZES;

export type ImageResult = { ok: true; png: Buffer } | { ok: false; error: "tooBig" | "notImage" };

export async function cleanImage(input: Buffer, kind: ImageKind): Promise<ImageResult> {
  if (input.length > MAX_UPLOAD_BYTES) return { ok: false, error: "tooBig" };
  try {
    const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) return { ok: false, error: "notImage" };

    const { width, height } = IMAGE_SIZES[kind];
    const png = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // follow the camera's orientation, then forget it
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { ok: true, png };
  } catch {
    return { ok: false, error: "notImage" }; // broken or fake image
  }
}
