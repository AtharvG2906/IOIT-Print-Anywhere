import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatRupees } from "@/lib/pricing";
import { getPrinterStatus } from "@/lib/settings";
import { queueInfoFor } from "@/lib/queueStatus";
import { QueueStatus } from "@/components/QueueStatus";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Alert, Card, PrintingCode, StatusBadge, buttonClass } from "@/components/ui";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : null;

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { document: true } });
  if (!order || (order.userId !== user.id && !user.isAdmin)) notFound();

  const live = ["PENDING_PAYMENT", "PAID", "PRINTING"].includes(order.status);
  const [queue, printer] = await Promise.all([queueInfoFor([order.id]), getPrinterStatus()]);
  const myQueue = queue.get(order.id);
  const timeline = [
    { label: "Paid", at: order.paidAt },
    { label: "Printing started", at: order.printStartedAt },
    { label: "Ready for pickup", at: order.readyAt },
    { label: "Collected", at: order.collectedAt },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {live && <AutoRefresh seconds={4} />}

      <Card className="text-center">
        <div className="mb-4">
          <StatusBadge status={order.status} />
        </div>
        {order.printingCode ? (
          <>
            <p className="mb-2 text-sm text-stone-500">Your printing code</p>
            <PrintingCode code={order.printingCode} />
            {myQueue && (
              <div className="mt-4 text-left">
                <QueueStatus info={myQueue} printerOnline={printer.online} />
              </div>
            )}
            <p className="mt-4 text-sm text-stone-600">
              {order.status === "READY"
                ? "Your prints are ready! Show this code and your college ID card at the desk."
                : order.status === "COLLECTED"
                  ? "Collected. Thanks for using IOIT Print Anywhere."
                  : order.status === "FAILED"
                    ? "Something went wrong while printing. Please show this code at the desk."
                    : "We'll email you as soon as your prints are ready. Bring your college ID card."}
            </p>
          </>
        ) : order.status === "PENDING_PAYMENT" ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Waiting for your payment.</p>
            <Link href={`/orders/${order.id}/pay`} className={buttonClass}>Go to payment</Link>
          </div>
        ) : (
          <p className="text-sm text-stone-600">This order wasn&apos;t paid in time and won&apos;t be printed.</p>
        )}
      </Card>

      {order.status === "FAILED" && order.failureReason && user.isAdmin && <Alert kind="error">{order.failureReason}</Alert>}

      <Card>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-stone-500">File</dt>
          <dd className="truncate text-right font-medium">{order.document.originalName}</dd>
          <dt className="text-stone-500">Pages</dt>
          <dd className="text-right font-medium">{order.pageRange === "all" ? "All" : order.pageRange} ({order.selectedPages})</dd>
          <dt className="text-stone-500">Copies</dt>
          <dd className="text-right font-medium">{order.copies}</dd>
          <dt className="text-stone-500">Amount</dt>
          <dd className="text-right font-medium">{formatRupees(order.amountPaise)}</dd>
        </dl>
        {order.printingCode && (
          <ol className="mt-5 space-y-2 border-t border-stone-200 pt-4">
            {timeline.map((t) => (
              <li key={t.label} className="flex items-center gap-3 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${t.at ? "bg-emerald-500" : "bg-stone-300"}`} />
                <span className={t.at ? "font-medium" : "text-stone-400"}>{t.label}</span>
                <span className="ml-auto text-xs text-stone-500">{fmt(t.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="text-center">
        <Link href="/orders" className="text-sm font-semibold underline">All my orders</Link>
      </div>
    </div>
  );
}
