import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatRupees } from "@/lib/pricing";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, PageTitle, PrintingCode, StatusBadge, buttonClass } from "@/components/ui";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    include: { document: { select: { originalName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasLive = orders.some((o) => ["PENDING_PAYMENT", "PAID", "PRINTING"].includes(o.status));

  return (
    <div className="mx-auto max-w-2xl">
      {hasLive && <AutoRefresh seconds={6} />}
      <div className="flex items-start justify-between gap-4">
        <PageTitle title="My orders" />
        <Link href="/print" className={buttonClass}>New print</Link>
      </div>
      {orders.length === 0 ? (
        <Card className="text-center text-sm text-stone-600">No orders yet.</Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={o.status === "PENDING_PAYMENT" ? `/orders/${o.id}/pay` : `/orders/${o.id}`} className="block">
                <Card className="flex items-center justify-between gap-4 p-4 transition hover:border-stone-400">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.document.originalName}</p>
                    <p className="text-xs text-stone-500">
                      {o.selectedPages} pages × {o.copies} · {formatRupees(o.amountPaise)} ·{" "}
                      {o.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={o.status} />
                    {o.printingCode && <PrintingCode code={o.printingCode} size="sm" />}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
