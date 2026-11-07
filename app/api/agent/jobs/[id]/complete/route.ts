import { checkAgentAuth } from "@/lib/agentAuth";
import { markOrderReady } from "@/lib/orders";

/** Printing finished: mark READY and email the student. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;
  const { id } = await params;
  const ok = await markOrderReady(id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "order is not printing" }, { status: 409 });
}
