import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Lightweight status for the pay and order pages to poll. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: { userId: true, status: true, printingCode: true, expiresAt: true },
  });
  if (!order || (order.userId !== user.id && !user.isAdmin)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(
    { status: order.status, printingCode: order.printingCode, expiresAt: order.expiresAt },
    { headers: { "cache-control": "no-store" } },
  );
}
