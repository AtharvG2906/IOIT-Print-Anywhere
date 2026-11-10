import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatRupees } from "@/lib/pricing";
import { getPrinterStatus } from "@/lib/settings";
import { queueInfoFor } from "@/lib/queueStatus";
import { AutoRefresh } from "@/components/AutoRefresh";
import { QueueStatus } from "@/components/QueueStatus";
import { Card, PrintingCode, StatusBadge, buttonClass, secondaryButtonClass } from "@/components/ui";

const LIVE = ["PENDING_PAYMENT", "PAID", "PRINTING", "READY"];

export default async function DashboardPage() {
  const user = await requireUser();
  // Only this student's own orders are ever loaded for display.
  const orders = await db.order.findMany({
    where: { userId: user.id },
    include: { document: { select: { originalName: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const active = orders.filter((o) => LIVE.includes(o.status));
  const past = orders.filter((o) => !LIVE.includes(o.status)).slice(0, 5);
  const [queue, printer] = await Promise.all([
    queueInfoFor(active.filter((o) => o.status === "PAID" || o.status === "PRINTING").map((o) => o.id)),
    getPrinterStatus(),
  ]);
  const refresh = active.some((o) => o.status !== "READY");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {refresh && <AutoRefresh seconds={8} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {user.fullName.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-stone-600">
            PRN {user.prn} · {user.department} · {user.className}
          </p>
        </div>
        <Link href="/print" className={buttonClass}>🖨️ Print a document</Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Your current orders</h2>
        {active.length === 0 ? (
          <Card className="text-center text-sm text-stone-600">
            Nothing printing right now.{" "}
            <Link href="/print" className="font-semibold underline">Upload a PDF</Link> to get started.
          </Card>
        ) : (
          active.map((o) => {
            const q = queue.get(o.id);
            return (
              <Card key={o.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.document.originalName}</p>
                    <p className="text-sm text-stone-600">
                      {o.pageRange === "all" ? "All pages" : `Pages ${o.pageRange}`} ({o.selectedPages}) · {o.copies}{" "}
                      {o.copies === 1 ? "copy" : "copies"} · {formatRupees(o.amountPaise)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {q && <QueueStatus info={q} printerOnline={printer.online} />}
                {o.status === "READY" && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
                    <p className="font-semibold">✅ Ready for pickup</p>
                    <p className="text-sm">Show this code and your college ID card at the desk.</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {o.printingCode ? (
                    <div>
                      <p className="text-xs text-stone-500">Printing code</p>
                      <PrintingCode code={o.printingCode} size="sm" />
                    </div>
                  ) : (
                    <span />
                  )}
                  {o.status === "PENDING_PAYMENT" ? (
                    <Link href={`/orders/${o.id}/pay`} className={buttonClass}>Pay now</Link>
                  ) : (
                    <Link href={`/orders/${o.id}`} className={secondaryButtonClass}>Details</Link>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Recent orders</h2>
          <Card className="divide-y divide-stone-100 p-0!">
            {past.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                <span className="min-w-0 truncate text-sm">{o.document.originalName}</span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </Card>
          <p className="text-center text-sm">
            <Link href="/orders" className="font-semibold underline">See all orders</Link>
          </p>
        </section>
      )}
    </div>
  );
}
