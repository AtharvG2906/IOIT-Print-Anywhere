import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";

type PaymentEntity = { id: string; amount: number; order_id?: string | null; status?: string };
type WebhookBody = {
  event: string;
  payload: {
    payment?: { entity: PaymentEntity };
    qr_code?: { entity: { id: string } };
  };
};

/**
 * Razorpay webhook. Subscribe to: payment.captured, order.paid, qr_code.credited.
 * Verified with RAZORPAY_WEBHOOK_SECRET; processing is idempotent.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const payment = body.payload.payment?.entity;

  if ((body.event === "payment.captured" || body.event === "order.paid") && payment?.order_id) {
    const order = await db.order.findUnique({ where: { razorpayOrderId: payment.order_id }, select: { id: true } });
    if (order) await markOrderPaid(order.id, { paymentId: payment.id, amountPaise: payment.amount, method: "checkout" });
  }

  if (body.event === "qr_code.credited" && payment && body.payload.qr_code) {
    const order = await db.order.findUnique({
      where: { razorpayQrId: body.payload.qr_code.entity.id },
      select: { id: true },
    });
    if (order) await markOrderPaid(order.id, { paymentId: payment.id, amountPaise: payment.amount, method: "qr" });
  }

  return Response.json({ ok: true });
}
