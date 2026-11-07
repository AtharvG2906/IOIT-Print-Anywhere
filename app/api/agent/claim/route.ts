import { db } from "@/lib/db";
import { checkAgentAuth } from "@/lib/agentAuth";
import { ensureCoverPage, markOrderPrintFailed } from "@/lib/orders";

/**
 * Hands the oldest paid order to the print agent and moves it to PRINTING.
 * The conditional update makes the claim atomic even with several agents.
 * Returns 204 when there is nothing to print.
 */
export async function POST(req: Request) {
  const denied = checkAgentAuth(req);
  if (denied) return denied;

  for (let i = 0; i < 5; i++) {
    const next = await db.order.findFirst({
      where: { status: "PAID" },
      orderBy: { paidAt: "asc" },
      select: { id: true },
    });
    if (!next) return new Response(null, { status: 204 });

    const now = new Date();
    const { count } = await db.order.updateMany({
      where: { id: next.id, status: "PAID" },
      data: { status: "PRINTING", printStartedAt: now, lastProgressAt: now, attempts: { increment: 1 } },
    });
    if (count === 0) continue; // another agent took it

    try {
      await ensureCoverPage(next.id);
    } catch (e) {
      await markOrderPrintFailed(next.id, `Cover page error: ${String(e)}`);
      continue;
    }

    const order = await db.order.findUniqueOrThrow({ where: { id: next.id }, include: { document: true } });
    return Response.json({
      orderId: order.id,
      printingCode: order.printingCode,
      copies: order.copies,
      pageRange: order.pageRange, // "all" or e.g. "1-3,5"
      selectedPages: order.selectedPages,
      fileName: order.document.originalName,
      coverUrl: `/api/agent/files/${order.id}/cover`,
      documentUrl: `/api/agent/files/${order.id}/document`,
    });
  }
  return new Response(null, { status: 204 });
}
