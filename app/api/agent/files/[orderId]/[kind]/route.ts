import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agentAuth";
import { storage } from "@/lib/storage";

/** The agent downloads the cover sheet and the student's PDF for an order it is printing. */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string; kind: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;
  const { orderId, kind } = await params;
  if (kind !== "cover" && kind !== "document") return Response.json({ error: "not found" }, { status: 404 });

  const order = await db.order.findUnique({ where: { id: orderId }, include: { document: true } });
  if (!order || order.status !== "PRINTING") return Response.json({ error: "not printing" }, { status: 409 });

  const key = kind === "cover" ? order.coverKey : order.document.storageKey;
  if (!key || (kind === "document" && order.document.deletedAt)) {
    return Response.json({ error: "file missing" }, { status: 410 });
  }
  const bytes = await storage().get(key);
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/pdf", "cache-control": "no-store" },
  });
}
