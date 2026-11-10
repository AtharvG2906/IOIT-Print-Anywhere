import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parsePageRange } from "@/lib/pageRange";
import { calculateAmountPaise } from "@/lib/pricing";
import { orderInputSchema } from "@/lib/validation";
import { ORDER_PAYMENT_WINDOW_MS } from "@/lib/orders";
import { createFixedAmountQr, createRazorpayOrder } from "@/lib/razorpay";

const err = (status: number, error: string) => Response.json({ error }, { status });

/** Creates an order with a server-calculated amount, plus its Razorpay order and fixed-amount QR. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err(401, "Please log in again.");

  const parsed = orderInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return err(400, "Invalid order details.");
  const { documentId, copies, pageRange } = parsed.data;

  const settings = await getSettings();
  if (!settings.acceptingOrders) return err(503, "The print desk isn't accepting orders right now.");
  if (copies > settings.maxCopies) return err(400, `You can order at most ${settings.maxCopies} copies.`);

  const doc = await db.document.findFirst({ where: { id: documentId, userId: user.id, deletedAt: null } });
  if (!doc) return err(404, "Document not found. Please upload it again.");

  const range = parsePageRange(pageRange, doc.pageCount);
  if (!range.ok) return err(400, range.error);

  // Never trust an amount from the browser.
  const amountPaise = calculateAmountPaise({
    selectedPages: range.selectedPages,
    copies,
    ratePaise: settings.ratePerPagePaise,
    maxCopies: settings.maxCopies,
  });
  const expiresAt = new Date(Date.now() + ORDER_PAYMENT_WINDOW_MS);

  const order = await db.order.create({
    data: {
      userId: user.id,
      documentId: doc.id,
      copies,
      pageRange: range.normalized,
      selectedPages: range.selectedPages,
      ratePaise: settings.ratePerPagePaise,
      amountPaise,
      expiresAt,
    },
  });

  if (!env.paymentsMock()) {
    try {
      const [rzpOrder, qr] = await Promise.all([
        createRazorpayOrder(order.id, amountPaise),
        createFixedAmountQr(order.id, amountPaise, expiresAt),
      ]);
      await db.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: rzpOrder.id, razorpayQrId: qr.id, qrImageUrl: qr.imageUrl },
      });
    } catch (e) {
      console.error("[orders] Razorpay setup failed", e);
      await db.order.update({ where: { id: order.id }, data: { status: "EXPIRED", failureReason: "Razorpay setup failed" } });
      return err(502, "Couldn't start the payment. Please try again in a moment.");
    }
  }

  return Response.json({ orderId: order.id });
}
