import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { formatRupees } from "@/lib/pricing";
import { Card, PageTitle } from "@/components/ui";
import { PayPanel } from "./PayPanel";

const isPayable = (o: { status: string; expiresAt: Date }) =>
  o.status === "PENDING_PAYMENT" && o.expiresAt.getTime() > Date.now();

export default async function PayPage({ params }: PageProps<"/orders/[id]/pay">) {
  const user = await requireUser();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { document: true } });
  if (!order || order.userId !== user.id) notFound();
  if (!isPayable(order)) redirect(`/orders/${id}`);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={`Pay ${formatRupees(order.amountPaise)}`} subtitle="Your document prints automatically once the payment goes through." />
      <Card className="mb-5">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-stone-500">File</dt>
          <dd className="truncate text-right font-medium">{order.document.originalName}</dd>
          <dt className="text-stone-500">Pages</dt>
          <dd className="text-right font-medium">
            {order.pageRange === "all" ? "All" : order.pageRange} ({order.selectedPages})
          </dd>
          <dt className="text-stone-500">Copies</dt>
          <dd className="text-right font-medium">{order.copies}</dd>
          <dt className="text-stone-500">Print</dt>
          <dd className="text-right font-medium">A4 · Black &amp; white</dd>
          <dt className="border-t border-stone-200 pt-2 font-semibold">Total</dt>
          <dd className="border-t border-stone-200 pt-2 text-right text-lg font-bold">{formatRupees(order.amountPaise)}</dd>
        </dl>
      </Card>
      <PayPanel
        orderId={order.id}
        amountPaise={order.amountPaise}
        expiresAt={order.expiresAt.toISOString()}
        qrImageUrl={order.qrImageUrl}
        razorpayOrderId={order.razorpayOrderId}
        razorpayKeyId={env.razorpay().keyId}
        mock={env.paymentsMock()}
        prefill={{ name: user.fullName, email: user.email, contact: `+91${user.phone}` }}
        description={`${order.selectedPages} pages × ${order.copies}`}
      />
    </div>
  );
}
