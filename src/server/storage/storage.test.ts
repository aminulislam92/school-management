import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "store-"));
  vi.stubEnv("STORAGE_DIR", dir);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("file storage (local)", () => {
  it("accepts only safe keys", async () => {
    const { isSafeKey } = await import("./index");
    for (const ok of ["schools/1/logo-ab12.png", "a.pdf", "schools/12/students/77-x_y.webp"]) expect(isSafeKey(ok)).toBe(true);
    for (const bad of ["../etc/passwd", "schools/../../x", "/abs.png", "schools/1/.env", "Schools/1/a.png", "a\\b.png", "", "schools//a.png"]) {
      expect(isSafeKey(bad)).toBe(false);
    }
  });

  it("puts, gets and deletes", async () => {
    const { getFileStore } = await import("./index");
    const store = getFileStore();
    await store.put("schools/1/logo-x.png", Buffer.from("hello"));
    expect((await store.get("schools/1/logo-x.png"))?.toString()).toBe("hello");
    await store.delete("schools/1/logo-x.png");
    expect(await store.get("schools/1/logo-x.png")).toBeNull();
    await store.delete("schools/1/logo-x.png"); // deleting twice is fine
    await expect(store.put("../escape.png", Buffer.from("x"))).rejects.toThrow("Unsafe");
  });

  it("knows content types", async () => {
    const { contentTypeFor, fileUrl } = await import("./index");
    expect(contentTypeFor("a/b.png")).toBe("image/png");
    expect(contentTypeFor("a/b.exe")).toBe("application/octet-stream");
    expect(fileUrl("schools/1/a.png")).toBe("/api/files/schools/1/a.png");
    expect(fileUrl(null)).toBeNull();
  });
});
