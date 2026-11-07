"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatRupees } from "@/lib/pricing";
import { Alert, Card, buttonClass, secondaryButtonClass } from "@/components/ui";

type Props = {
  orderId: string;
  amountPaise: number;
  expiresAt: string;
  qrImageUrl: string | null;
  razorpayOrderId: string | null;
  razorpayKeyId: string;
  mock: boolean;
  prefill: { name: string; email: string; contact: string };
  description: string;
};

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, cb: (r: { error: { description: string } }) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PayPanel(p: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((Date.parse(p.expiresAt) - Date.now()) / 1000)));

  const goToOrder = useCallback(() => router.replace(`/orders/${p.orderId}`), [router, p.orderId]);

  // Poll for payment (covers QR payments confirmed by webhook).
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/orders/${p.orderId}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (data && data.status !== "PENDING_PAYMENT") goToOrder();
    }, 3000);
    return () => clearInterval(t);
  }, [p.orderId, goToOrder]);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function payWithCheckout() {
    setError(null);
    setBusy(true);
    if (!(await loadCheckoutScript()) || !window.Razorpay) {
      setBusy(false);
      return setError("Couldn't load Razorpay. Check your connection and try again.");
    }
    const rzp = new window.Razorpay({
      key: p.razorpayKeyId,
      amount: p.amountPaise,
      currency: "INR",
      order_id: p.razorpayOrderId,
      name: "IOIT Print Anywhere",
      description: p.description,
      prefill: p.prefill,
      theme: { color: "#1c1917" },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (response: RazorpayResponse) => {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: p.orderId, ...response }),
        });
        if (res.ok) return goToOrder();
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        setError(data.error ?? "We couldn't confirm the payment yet. If money was deducted, it will update automatically in a minute.");
      },
    });
    rzp.on("payment.failed", (r) => {
      setBusy(false);
      setError(`Payment failed: ${r.error.description}`);
    });
    rzp.open();
  }

  async function simulate() {
    setBusy(true);
    const res = await fetch("/api/dev/simulate-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: p.orderId }),
    });
    if (res.ok) return goToOrder();
    setBusy(false);
    setError("Simulated payment failed.");
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (secondsLeft === 0) {
    return (
      <Alert kind="error">
        This payment window has expired. <a href="/print" className="font-semibold underline">Start a new order</a>.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="text-center">
        <p className="mb-1 text-sm font-semibold">Scan &amp; pay with any UPI app</p>
        <p className="mb-4 text-xs text-stone-500">GPay, PhonePe, Paytm, BHIM… The QR only accepts exactly {formatRupees(p.amountPaise)}.</p>
        {p.mock ? (
          <div className="mx-auto grid h-56 w-56 place-items-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
            Test mode — Razorpay keys aren&apos;t set, so no real QR is shown.
          </div>
        ) : p.qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.qrImageUrl} alt={`UPI QR code for ${formatRupees(p.amountPaise)}`} className="mx-auto w-64 rounded-xl" />
        ) : (
          <p className="text-sm text-stone-500">QR unavailable — use the button below.</p>
        )}
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-stone-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Waiting for payment · expires in {mm}:{ss}
        </p>
      </Card>

      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" /> or <span className="h-px flex-1 bg-stone-200" />
      </div>

      {p.mock ? (
        <button onClick={simulate} disabled={busy} className={`${buttonClass} w-full py-3`}>
          {busy ? "Processing…" : `Simulate payment of ${formatRupees(p.amountPaise)} (dev only)`}
        </button>
      ) : (
        <button onClick={payWithCheckout} disabled={busy || !p.razorpayOrderId} className={`${buttonClass} w-full py-3`}>
          {busy ? "Opening Razorpay…" : `Pay ${formatRupees(p.amountPaise)} with Razorpay`}
        </button>
      )}
      <p className="text-center text-xs text-stone-500">UPI apps, cards and netbanking via Razorpay. Don&apos;t close this page until it confirms.</p>
      <button onClick={() => router.push("/print")} className={`${secondaryButtonClass} w-full`}>Cancel</button>
    </div>
  );
}
