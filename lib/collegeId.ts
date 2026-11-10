import "server-only";
import { randomToken } from "@/lib/crypto";
import { sniffIdType } from "@/lib/fileSniff";
import { storage } from "@/lib/storage";
import { deleteFromDrive, downloadFromDrive, driveConfigured, uploadToDrive } from "@/lib/googleDrive";

/**
 * College ID cards. When Google Drive is set up they go into the admin's private Drive folder
 * (stored key: "gdrive:<fileId>.<ext>"); otherwise into the normal file storage (local disk in dev).
 */

export const COLLEGE_ID_MAX_BYTES = 4 * 1024 * 1024; // Vercel accepts request bodies up to ~4.5 MB

export type CheckedId = { bytes: Uint8Array; ext: string; type: string };

/** Validates an uploaded ID file. Returns the checked file or an error message for the student. */
export async function checkCollegeIdFile(file: FormDataEntryValue | null): Promise<CheckedId | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > COLLEGE_ID_MAX_BYTES) return { error: "ID card file must be 4 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffIdType(bytes);
  if (!kind) return { error: "Upload a JPG, PNG or PDF of your ID card." };
  return { bytes, ...kind };
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 60) || "student";

/** Saves the ID and returns the key to store on the user. Throws on failure (callers show a message). */
export async function saveCollegeId(id: CheckedId, who: { prn: string; fullName: string }): Promise<string> {
  if (driveConfigured()) {
    const fileId = await uploadToDrive(`College ID - ${safeName(who.prn)} - ${safeName(who.fullName)}.${id.ext}`, id.bytes, id.type);
    return `gdrive:${fileId}.${id.ext}`;
  }
  const key = `college-ids/${randomToken(12)}.${id.ext}`;
  await storage().put(key, id.bytes, id.type);
  return key;
}

const driveId = (key: string) => key.slice("gdrive:".length).replace(/\.[a-z]+$/, "");

export async function readCollegeId(key: string): Promise<Buffer> {
  return key.startsWith("gdrive:") ? downloadFromDrive(driveId(key)) : storage().get(key);
}

export async function deleteCollegeId(key: string): Promise<void> {
  if (key.startsWith("gdrive:")) await deleteFromDrive(driveId(key));
  else await storage().remove(key);
}
