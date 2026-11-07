import { z } from "zod";
import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agentAuth";
import { maybeRunMaintenance } from "@/lib/orders";

const schema = z.object({
  agentId: z.string().min(1).max(64),
  printerStatus: z.string().max(200).optional(),
  currentOrderId: z.string().max(64).nullish(),
});

/** The agent checks in every few seconds; this also drives periodic maintenance. */
export async function POST(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { agentId, printerStatus, currentOrderId } = parsed.data;

  await db.agentHeartbeat.upsert({
    where: { agentId },
    create: { agentId, printerStatus, currentOrder: currentOrderId ?? null },
    update: { lastSeenAt: new Date(), printerStatus, currentOrder: currentOrderId ?? null },
  });
  // A long job is still alive as long as the agent keeps reporting it.
  if (currentOrderId) {
    await db.order.updateMany({ where: { id: currentOrderId, status: "PRINTING" }, data: { lastProgressAt: new Date() } });
  }

  await maybeRunMaintenance();
  return Response.json({ ok: true });
}
