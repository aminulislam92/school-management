// File storage (logos, signatures, later student photos and attachments).
// The app only talks to `FileStore`, so moving to S3-compatible storage
// (task T7.9) means adding one driver here and changing `.env` — no other code.
//   STORAGE_DRIVER=local   STORAGE_DIR=./storage   (default; files on this server's disk)
import "server-only";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileStore {
  put(key: string, body: Buffer): Promise<void>;
  /** null when the file does not exist. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Keys look like "schools/12/logo-k3j9x2.png": lowercase, no "..", no leading "/". */
const SAFE_KEY = /^(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_.-]*$/;

export function isSafeKey(key: string): boolean {
  return key.length <= 200 && SAFE_KEY.test(key) && !key.split("/").some((part) => part === ".." || part.startsWith("."));
}

function localStore(dir: string): FileStore {
  const root = path.resolve(dir);
  const fileFor = (key: string) => {
    if (!isSafeKey(key)) throw new Error(`Unsafe file key: ${key}`);
    const file = path.resolve(root, key);
    if (!file.startsWith(root + path.sep)) throw new Error(`Unsafe file key: ${key}`);
    return file;
  };
  return {
    async put(key, body) {
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      // Write to a temp file first, so a reader never sees half a file.
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, file);
    },
    async get(key) {
      try {
        return await readFile(fileFor(key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
  };
}

let store: FileStore | undefined;

export function getFileStore(): FileStore {
  if (store) return store;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") return (store = localStore(process.env.STORAGE_DIR ?? "storage"));
  throw new Error(`STORAGE_DRIVER "${driver}" is not available yet (S3 comes in task T7.9).`);
}

/** The address the browser uses for a stored file. */
export const fileUrl = (key: string | null | undefined) => (key ? `/api/files/${key}` : null);

/** Content type from the file name (we only store a few kinds). */
export function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1);
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
}
