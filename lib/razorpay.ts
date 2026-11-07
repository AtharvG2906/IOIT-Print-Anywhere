import "server-only";
import Razorpay from "razorpay";
import { env } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";

let client: Razorpay | undefined;
function rzp(): Razorpay {
  const { keyId, keySecret } = env.razorpay();
  if (!keyId || !keySecret) throw new Error("Razorpay keys are not configured");
  client ??= new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export async function createRazorpayOrder(orderId: string, amountPaise: number) {
  const order = await rzp().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: orderId,
    notes: { orderId },
  });
  return { id: order.id };
}

/** Single-use UPI QR that only accepts exactly `amountPaise`. */
export async function createFixedAmountQr(orderId: string, amountPaise: number, closeBy: Date) {
  // The SDK's typings lag behind the API, so build the payload loosely.
  const payload = {
    type: "upi_qr",
    name: "IOIT Print Anywhere",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: amountPaise,
    description: `Print order ${orderId}`,
    close_by: Math.floor(closeBy.getTime() / 1000),
    notes: { orderId },
  };
  const qr = (await (rzp().qrCode.create as (p: unknown) => Promise<unknown>)(payload)) as {
    id: string;
    image_url: string;
  };
  return { id: qr.id, imageUrl: qr.image_url };
}

export async function closeQr(qrId: string) {
  try {
    await rzp().qrCode.close(qrId);
  } catch (err) {
    // Already closed / already paid — nothing to do.
    console.warn("[razorpay] could not close QR", qrId, String(err));
  }
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(razorpayOrderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = env.razorpay();
  if (!keySecret) return false;
  return safeEqual(hmacSha256Hex(keySecret, `${razorpayOrderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const { webhookSecret } = env.razorpay();
  if (!webhookSecret || !signature) return false;
  return safeEqual(hmacSha256Hex(webhookSecret, rawBody), signature);
}
