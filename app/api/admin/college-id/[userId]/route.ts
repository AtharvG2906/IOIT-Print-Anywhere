import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readCollegeId } from "@/lib/collegeId";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

/** Lets desk staff view a student's uploaded college ID. Admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { userId } = await params;

  const user = await db.user.findUnique({ where: { id: userId }, select: { collegeIdKey: true } });
  if (!user?.collegeIdKey) return Response.json({ error: "not found" }, { status: 404 });

  const ext = user.collegeIdKey.split(".").pop() ?? "";
  let bytes: Buffer;
  try {
    bytes = await readCollegeId(user.collegeIdKey);
  } catch (err) {
    console.error("[college-id] read failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't load this ID right now." }, { status: 502 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
