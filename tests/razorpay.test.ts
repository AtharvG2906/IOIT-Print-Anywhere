import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "key_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret";
});

describe("Razorpay signatures", () => {
  it("verifies the Checkout signature and rejects tampering", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const sig = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig)).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_2", sig)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", "0".repeat(64))).toBe(false);
  });

  it("verifies webhook bodies", async () => {
    const { verifyWebhookSignature } = await import("@/lib/razorpay");
    const body = JSON.stringify({ event: "qr_code.credited" });
    const sig = createHmac("sha256", "webhook_secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body.replace("credited", "closed"), sig)).toBe(false);
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });
});
