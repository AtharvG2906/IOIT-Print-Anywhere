import { checkAgentAuth } from "@/lib/agentAuth";
import { markOrderPrintFailed } from "@/lib/orders";

/** Printing failed: requeue for another attempt, or mark FAILED after the last one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  await markOrderPrintFailed(id, String(reason ?? "Unknown print error"));
  return Response.json({ ok: true });
}
