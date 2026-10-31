import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cleanImage } from "./images";

const photo = (w: number, h: number, format: "jpeg" | "png" | "webp" | "gif" = "jpeg") =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#3366aa" } })
    .withMetadata({ exif: { IFD0: { Make: "PhoneCam" } } })
    [format]()
    .toBuffer();

describe("cleanImage", () => {
  it("shrinks a big photo to fit, as PNG, without camera data", async () => {
    const r = await cleanImage(await photo(3000, 2000), "logo");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const meta = await sharp(r.png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 512, 341]);
    expect(meta.exif).toBeUndefined();
  });

  it("does not enlarge a small image; signature box is wide", async () => {
    const small = await cleanImage(await photo(100, 50, "png"), "logo");
    expect(small.ok && (await sharp(small.png).metadata()).width).toBe(100);
    const sig = await cleanImage(await photo(2000, 1000, "webp"), "signature");
    expect(sig.ok && [(await sharp(sig.png).metadata()).width, (await sharp(sig.png).metadata()).height]).toEqual([480, 240]);
  });

  it("refuses non-images, other formats and huge files", async () => {
    expect(await cleanImage(Buffer.from("<svg onload=alert(1)>"), "logo")).toEqual({ ok: false, error: "notImage" });
    expect(await cleanImage(Buffer.from("%PDF-1.7 fake"), "logo")).toEqual({ ok: false, error: "notImage" });
    expect(await cleanImage(await photo(10, 10, "gif"), "logo")).toEqual({ ok: false, error: "notImage" });
    expect(await cleanImage(Buffer.alloc(6 * 1024 * 1024), "logo")).toEqual({ ok: false, error: "tooBig" });
  });
});
