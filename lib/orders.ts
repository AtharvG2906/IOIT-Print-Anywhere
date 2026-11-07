import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { buildCoverPage } from "@/lib/pdf";
import { formatRupees } from "@/lib/pricing";
import { generatePrintingCode } from "@/lib/printingCode";
import { closeQr } from "@/lib/razorpay";
import { sendPaymentReceivedEmail, sendPrintsReadyEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/prisma/client";

export const ORDER_PAYMENT_WINDOW_MS = 30 * 60 * 1000;
export const MAX_PRINT_ATTEMPTS = 3;
const STUCK_PRINTING_MS = 10 * 60 * 1000;
const DELETE_AFTER_COLLECTED_MS = 24 * 60 * 60 * 1000;
const DELETE_UNPAID_AFTER_MS = 48 * 60 * 60 * 1000;

type PaidVia = { paymentId: string; amountPaise: number; method: "checkout" | "qr" | "mock" };

const orderUrl = (id: string) => `${env.appUrl()}/orders/${id}`;

/**
 * Marks an order paid exactly once (safe to call from both the Checkout callback
 * and webhooks). Assigns the printing code, builds the cover page and emails the student.
 */
export async function markOrderPaid(orderId: string, via: PaidVia): Promise<{ ok: boolean; reason?: string }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "order not found" };
  if (order.status !== "PENDING_PAYMENT" && order.status !== "EXPIRED") return { ok: true, reason: "already processed" };

  if (via.amountPaise !== order.amountPaise) {
    console.error(`[orders] amount mismatch on ${orderId}: got ${via.amountPaise}, expected ${order.amountPaise}`);
    await db.order.update({
      where: { id: orderId },
      data: { failureReason: `Payment ${via.paymentId} amount ${via.amountPaise} did not match ${order.amountPaise}` },
    });
    return { ok: false, reason: "amount mismatch" };
  }

  // A late payment on an expired order is still honoured — the student paid.
  let claimed = false;
  for (let attempt = 0; attempt < 8 && !claimed; attempt++) {
    try {
      const { count } = await db.order.updateMany({
        where: { id: orderId, status: { in: ["PENDING_PAYMENT", "EXPIRED"] } },
        data: {
          status: "PAID",
          printingCode: generatePrintingCode(),
          paidAt: new Date(),
          razorpayPaymentId: via.paymentId,
          failureReason: null,
        },
      });
      if (count === 0) return { ok: true, reason: "already processed" };
      claimed = true;
    } catch (err) {
      // Printing code collision — try another code.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  if (!claimed) throw new Error("Could not allocate a unique printing code");

  // Close the payment option that wasn't used so it can't be paid twice.
  if (via.method !== "qr" && order.razorpayQrId) await closeQr(order.razorpayQrId);

  await ensureCoverPage(orderId).catch((err) => console.error("[orders] cover page failed", err));

  const full = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, document: true } });
  await sendPaymentReceivedEmail({
    to: full.user.email,
    name: full.user.fullName,
    code: full.printingCode!,
    fileName: full.document.originalName,
    amount: formatRupees(full.amountPaise),
    orderUrl: orderUrl(orderId),
  });
  return { ok: true };
}

/** Generates and stores the cover sheet if it doesn't exist yet. */
export async function ensureCoverPage(orderId: string): Promise<string> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, document: true } });
  if (order.coverKey) return order.coverKey;
  if (!order.printingCode || !order.paidAt) throw new Error("Order is not paid");

  const bytes = await buildCoverPage({
    printingCode: order.printingCode,
    fullName: order.user.fullName,
    prn: order.user.prn,
    department: order.user.department,
    academicYear: order.user.academicYear,
    className: order.user.className,
    batch: order.user.batch,
    phoneLast4: order.user.phone.slice(-4),
    fileName: order.document.originalName,
    pageRange: order.pageRange,
    selectedPages: order.selectedPages,
    copies: order.copies,
    amount: formatRupees(order.amountPaise),
    paidAt: order.paidAt,
  });
  const key = `covers/${order.id}.pdf`;
  await storage().put(key, bytes, "application/pdf");
  await db.order.update({ where: { id: order.id }, data: { coverKey: key } });
  return key;
}

export async function markOrderReady(orderId: string): Promise<boolean> {
  const { count } = await db.order.updateMany({
    where: { id: orderId, status: "PRINTING" },
    data: { status: "READY", readyAt: new Date(), failureReason: null },
  });
  if (count === 0) return false;
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, document: true } });
  await sendPrintsReadyEmail({
    to: o.user.email,
    name: o.user.fullName,
    code: o.printingCode!,
    fileName: o.document.originalName,
    amount: formatRupees(o.amountPaise),
    orderUrl: orderUrl(orderId),
  });
  return true;
}

/** Called when the agent reports a failure: retry up to MAX_PRINT_ATTEMPTS, then FAILED. */
export async function markOrderPrintFailed(orderId: string, reason: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PRINTING") return;
  const giveUp = order.attempts >= MAX_PRINT_ATTEMPTS;
  await db.order.updateMany({
    where: { id: orderId, status: "PRINTING" },
    data: { status: giveUp ? "FAILED" : "PAID", failureReason: reason.slice(0, 500) },
  });
}

/** Expire unpaid orders, requeue stuck print jobs and delete old files. Idempotent. */
export async function runMaintenance() {
  const now = Date.now();

  const expired = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date(now) } },
    select: { id: true, razorpayQrId: true },
  });
  for (const o of expired) {
    const { count } = await db.order.updateMany({ where: { id: o.id, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
    if (count && o.razorpayQrId && !env.paymentsMock()) await closeQr(o.razorpayQrId);
  }

  const stuck = await db.order.findMany({
    where: {
      status: "PRINTING",
      OR: [
        { lastProgressAt: { lt: new Date(now - STUCK_PRINTING_MS) } },
        { lastProgressAt: null, printStartedAt: { lt: new Date(now - STUCK_PRINTING_MS) } },
      ],
    },
    select: { id: true },
  });
  for (const o of stuck) await markOrderPrintFailed(o.id, "Print agent stopped responding");

  // Delete files after pickup, and for orders that were never paid.
  const toClean = await db.order.findMany({
    where: {
      filesDeletedAt: null,
      OR: [
        { status: "COLLECTED", collectedAt: { lt: new Date(now - DELETE_AFTER_COLLECTED_MS) } },
        { status: "EXPIRED", createdAt: { lt: new Date(now - DELETE_UNPAID_AFTER_MS) } },
      ],
    },
    include: { document: true },
    take: 100,
  });
  for (const o of toClean) {
    if (o.coverKey) await storage().remove(o.coverKey).catch(() => {});
    const othersActive = await db.order.count({
      where: { documentId: o.documentId, id: { not: o.id }, status: { in: ["PENDING_PAYMENT", "PAID", "PRINTING", "READY"] } },
    });
    if (!othersActive && !o.document.deletedAt) {
      await storage().remove(o.document.storageKey).catch(() => {});
      await db.document.update({ where: { id: o.documentId }, data: { deletedAt: new Date() } });
    }
    await db.order.update({ where: { id: o.id }, data: { filesDeletedAt: new Date() } });
  }

  // Uploads that never became an order.
  const orphans = await db.document.findMany({
    where: { deletedAt: null, orders: { none: {} }, createdAt: { lt: new Date(now - DELETE_UNPAID_AFTER_MS) } },
    take: 100,
  });
  for (const d of orphans) {
    await storage().remove(d.storageKey).catch(() => {});
    await db.document.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
  }

  await db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  await db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } });

  return { expired: expired.length, requeued: stuck.length, cleaned: toClean.length + orphans.length };
}

let lastMaintenance = 0;
/** Runs maintenance at most once a minute; used from the agent heartbeat. */
export async function maybeRunMaintenance() {
  if (Date.now() - lastMaintenance < 60 * 1000) return;
  lastMaintenance = Date.now();
  await runMaintenance().catch((err) => console.error("[maintenance] failed", err));
}
