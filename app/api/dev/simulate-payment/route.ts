import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { markOrderPaid } from "@/lib/orders";
import { randomToken } from "@/lib/crypto";

/** Development only: pretend Razorpay confirmed the payment. Disabled once Razorpay keys are set. */
export async function POST(req: Request) {
  if (!env.paymentsMock()) return Response.json({ error: "not available" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  const order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order || order.userId !== user.id) return Response.json({ error: "not found" }, { status: 404 });

  const result = await markOrderPaid(order.id, {
    paymentId: `mock_${randomToken(8)}`,
    amountPaise: order.amountPaise,
    method: "mock",
  });
  return Response.json(result);
}
