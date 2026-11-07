import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { markOrderPaid } from "@/lib/orders";
import { verifyCheckoutSignature } from "@/lib/razorpay";

const schema = z.object({
  orderId: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

/** Called by the browser after Razorpay Checkout succeeds. The webhook is the backup path. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid payment details." }, { status: 400 });
  const p = parsed.data;

  const order = await db.order.findUnique({ where: { id: p.orderId } });
  if (!order || order.userId !== user.id || order.razorpayOrderId !== p.razorpay_order_id) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  if (!verifyCheckoutSignature(p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) {
    return Response.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  // A valid signature proves this Razorpay order (created by us for amountPaise) was paid.
  const result = await markOrderPaid(order.id, {
    paymentId: p.razorpay_payment_id,
    amountPaise: order.amountPaise,
    method: "checkout",
  });
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ error: "Payment could not be applied. Contact the desk." }, { status: 409 });
}
