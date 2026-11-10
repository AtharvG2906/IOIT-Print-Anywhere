import "server-only";

/**
 * Minimal Google Drive client (plain fetch, no SDK) that acts as the admin's Google account,
 * using a refresh token created once with `npm run drive:setup`.
 * Only used to keep college ID cards in the admin's private Drive folder.
 */

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error === "invalid_grant"
        ? "Google Drive sign-in expired or was revoked. Run `npm run drive:setup` again and update GOOGLE_REFRESH_TOKEN."
        : `Google sign-in failed (${res.status} ${data.error ?? ""})`,
    );
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function driveError(res: Response, action: string): Promise<Error> {
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return new Error(`Google Drive ${action} failed (${res.status}): ${data.error?.message ?? res.statusText}`);
}

/** Builds a multipart/related upload body: JSON metadata + file bytes. Exported for tests. */
export function buildMultipartBody(metadata: object, bytes: Uint8Array, contentType: string, boundary: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
}

/** Uploads a file into GOOGLE_DRIVE_FOLDER_ID and returns its Drive file id. */
export async function uploadToDrive(name: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const boundary = `pa-${crypto.randomUUID()}`;
  const body = buildMultipartBody({ name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] }, bytes, contentType, boundary);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(body),
    },
  );
  if (!res.ok) throw await driveError(res, "upload");
  const { id } = (await res.json()) as { id: string };
  return id;
}

export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${await accessToken()}` } },
  );
  if (!res.ok) throw await driveError(res, "download");
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok && res.status !== 404) throw await driveError(res, "delete");
}
