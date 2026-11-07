import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import { sniffIdType } from "@/lib/fileSniff";

const MAX_BYTES = 5 * 1024 * 1024;
const err = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err(401, "Please log in again.");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return err(400, "Upload failed. Please try again.");
  }
  if (!(file instanceof File) || file.size === 0) return err(400, "Choose a photo or PDF of your college ID.");
  if (file.size > MAX_BYTES) return err(413, "College ID file must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffIdType(bytes);
  if (!kind) return err(400, "Upload a JPG, PNG or PDF.");

  const key = `college-ids/${user.id}/${randomToken(12)}.${kind.ext}`;
  await storage().put(key, bytes, kind.type);

  const previous = await db.user.findUnique({ where: { id: user.id }, select: { collegeIdKey: true } });
  await db.user.update({ where: { id: user.id }, data: { collegeIdKey: key } });
  if (previous?.collegeIdKey) await storage().remove(previous.collegeIdKey).catch(() => {});

  return Response.json({ ok: true });
}
