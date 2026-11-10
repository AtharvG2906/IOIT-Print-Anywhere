import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Private file storage. "local" writes under LOCAL_STORAGE_DIR (development);
 * "s3" works with AWS S3 or Cloudflare R2. Files are never served publicly —
 * only through authenticated routes.
 */
type Driver = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
};

function safeKey(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

function localDriver(): Driver {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_STORAGE_DIR ?? "./storage");
  const full = (key: string) => path.join(/*turbopackIgnore: true*/ root, safeKey(key));
  return {
    async put(key, body) {
      await mkdir(path.dirname(full(key)), { recursive: true });
      await writeFile(full(key), body);
    },
    get: (key) => readFile(full(key)),
    async remove(key) {
      await rm(full(key), { force: true });
    },
  };
}

function s3Driver(): Driver {
  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const Bucket = process.env.S3_BUCKET ?? "";
  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: safeKey(key), Body: body, ContentType: contentType }));
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: safeKey(key) }));
      return Buffer.from(await res.Body!.transformToByteArray());
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: safeKey(key) }));
    },
  };
}

export class StorageNotConfiguredError extends Error {}

/** Used on Vercel without S3: every call fails (as a rejected promise) with a clear message. */
function notConfiguredDriver(): Driver {
  const fail = () =>
    Promise.reject(
      new StorageNotConfiguredError(
        'File storage is not configured: set STORAGE_DRIVER="s3" and the S3_* variables (e.g. Cloudflare R2) in Vercel.',
      ),
    );
  return { put: fail, get: fail, remove: fail };
}

let driver: Driver | undefined;
export function storage(): Driver {
  driver ??=
    process.env.STORAGE_DRIVER === "s3"
      ? s3Driver()
      : process.env.VERCEL // Vercel's filesystem is read-only, so local storage can't work there.
        ? notConfiguredDriver()
        : localDriver();
  return driver;
}

/** Saves a file; returns an error message for the student instead of throwing. */
export async function putFileSafely(key: string, body: Uint8Array, contentType: string): Promise<string | null> {
  try {
    await storage().put(key, body, contentType);
    return null;
  } catch (err) {
    console.error("[storage] put failed:", err instanceof Error ? err.message : err);
    return err instanceof StorageNotConfiguredError
      ? "Uploads aren't set up on the server yet. Please tell the print desk."
      : "We couldn't save your file right now. Please try again in a minute.";
  }
}
