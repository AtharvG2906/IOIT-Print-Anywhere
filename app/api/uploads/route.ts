import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { inspectPdf } from "@/lib/pdf";
import { storage } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";

const err = (status: number, error: string) => Response.json({ error }, { status });

function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document.pdf";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
  return cleaned || "document.pdf";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err(401, "Please log in again.");
  if (!user.hasCollegeId && !user.isAdmin) return err(403, "Upload your college ID before printing.");

  const settings = await getSettings();
  if (!settings.acceptingOrders) return err(503, "The print desk isn't accepting orders right now.");

  const maxBytes = settings.maxFileMB * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 1024 * 1024) return err(413, `File is larger than ${settings.maxFileMB} MB.`);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return err(400, "Upload failed. Please try again.");
  }
  if (!(file instanceof File)) return err(400, "Choose a PDF file to upload.");
  if (file.size > maxBytes) return err(413, `File is larger than ${settings.maxFileMB} MB.`);
  if (file.size === 0) return err(400, "This file is empty.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectPdf(bytes);
  if (!info.ok) return err(400, info.error);
  if (info.pageCount > settings.maxPages) {
    return err(400, `This PDF has ${info.pageCount} pages. The limit is ${settings.maxPages} pages per file.`);
  }

  const key = `documents/${user.id}/${randomToken(12)}.pdf`;
  await storage().put(key, bytes, "application/pdf");
  const doc = await db.document.create({
    data: {
      userId: user.id,
      storageKey: key,
      originalName: cleanFileName(file.name),
      pageCount: info.pageCount,
      nonA4Pages: info.nonA4Pages,
      sizeBytes: file.size,
    },
  });

  return Response.json({
    documentId: doc.id,
    name: doc.originalName,
    pageCount: doc.pageCount,
    nonA4Pages: doc.nonA4Pages,
    sizeBytes: doc.sizeBytes,
  });
}
