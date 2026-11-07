import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getPrinterStatus, getSettings } from "@/lib/settings";
import { formatRupees } from "@/lib/pricing";
import { normalizePrintingCode } from "@/lib/printingCode";
import { markCollected, reprintOrder, setAcceptingOrders, updateSettings } from "@/app/actions/admin";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Card, PrintingCode, StatusBadge, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

/** Midnight today in India, as a UTC Date (the server may run in another timezone). */
function startOfTodayIST() {
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(Date.now() + offset);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - offset);
}

const time = (d: Date | null) =>
  d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const codeInput = typeof sp.code === "string" ? sp.code : "";
  const code = codeInput ? normalizePrintingCode(codeInput) : null;

  const [settings, printer, queue, found, todayStats] = await Promise.all([
    getSettings(),
    getPrinterStatus(),
    db.order.findMany({
      where: { status: { in: ["PAID", "PRINTING", "READY", "FAILED"] } },
      include: { user: { select: { fullName: true, prn: true } }, document: { select: { originalName: true } } },
      orderBy: { paidAt: "asc" },
      take: 200,
    }),
    code
      ? db.order.findUnique({ where: { printingCode: code }, include: { user: true, document: { select: { originalName: true } } } })
      : null,
    db.order.aggregate({
      where: { paidAt: { gte: startOfTodayIST() } },
      _count: true,
      _sum: { amountPaise: true },
    }),
  ]);

  const counts = Object.fromEntries(["PAID", "PRINTING", "READY", "FAILED"].map((s) => [s, queue.filter((o) => o.status === s).length]));

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Print desk</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/users" className={secondaryButtonClass}>Students</Link>
          <form action={setAcceptingOrders}>
            <input type="hidden" name="accepting" value={String(!settings.acceptingOrders)} />
            <button className={settings.acceptingOrders ? secondaryButtonClass : buttonClass}>
              {settings.acceptingOrders ? "Pause new orders" : "Resume orders"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Printer" value={printer.online ? "Online" : "Offline"} tone={printer.online ? "good" : "bad"} sub={printer.printerStatus ?? (printer.lastSeenAt ? `seen ${time(printer.lastSeenAt)}` : "never seen")} />
        <Stat label="Orders" value={settings.acceptingOrders ? "Open" : "Paused"} tone={settings.acceptingOrders ? "good" : "bad"} />
        <Stat label="In queue" value={counts.PAID + counts.PRINTING} />
        <Stat label="Ready" value={counts.READY} />
        <Stat label="Failed" value={counts.FAILED} tone={counts.FAILED ? "bad" : undefined} />
        <Stat label="Today" value={formatRupees(todayStats._sum.amountPaise ?? 0)} sub={`${todayStats._count} paid orders`} />
      </div>

      {/* Pickup lookup */}
      <Card className="space-y-4">
        <form className="flex flex-wrap gap-2" action="/admin">
          <input name="code" defaultValue={codeInput} placeholder="Enter printing code, e.g. K7Q-4MZ" className={`${inputClass} max-w-xs font-mono uppercase`} autoComplete="off" />
          <button className={buttonClass}>Look up</button>
          {codeInput && <Link href="/admin" className={secondaryButtonClass}>Clear</Link>}
        </form>
        {codeInput && !found && <Alert kind="error">No order found for “{codeInput}”.</Alert>}
        {found && (
          <div className="grid gap-5 md:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <PrintingCode code={found.printingCode!} size="sm" />
                <StatusBadge status={found.status} />
              </div>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
                <dt className="text-stone-500">Name</dt><dd className="font-semibold">{found.user.fullName}</dd>
                <dt className="text-stone-500">PRN</dt><dd className="font-mono font-semibold">{found.user.prn}</dd>
                <dt className="text-stone-500">Department</dt><dd>{found.user.department || "—"}</dd>
                <dt className="text-stone-500">Year / class / batch</dt><dd>{found.user.academicYear} / {found.user.className} / {found.user.batch}</dd>
                <dt className="text-stone-500">Phone</dt><dd>+91 {found.user.phone}</dd>
                <dt className="text-stone-500">File</dt><dd className="truncate">{found.document.originalName}</dd>
                <dt className="text-stone-500">Pages × copies</dt><dd>{found.pageRange === "all" ? "All" : found.pageRange} ({found.selectedPages}) × {found.copies}</dd>
                <dt className="text-stone-500">Paid</dt><dd>{formatRupees(found.amountPaise)} at {time(found.paidAt)}</dd>
              </dl>
              {found.user.blocked && <Alert kind="error">This student&apos;s account is blocked.</Alert>}
              <div className="flex gap-2">
                {found.status === "READY" && (
                  <form action={markCollected}>
                    <input type="hidden" name="orderId" value={found.id} />
                    <SubmitButton>✓ ID verified — mark collected</SubmitButton>
                  </form>
                )}
                {found.status === "FAILED" && (
                  <form action={reprintOrder}>
                    <input type="hidden" name="orderId" value={found.id} />
                    <SubmitButton>Send to printer again</SubmitButton>
                  </form>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-stone-500">College ID on file</p>
              {found.user.collegeIdKey ? (
                found.user.collegeIdKey.endsWith(".pdf") ? (
                  <a href={`/api/admin/college-id/${found.user.id}`} target="_blank" className="text-sm font-semibold underline">Open ID (PDF)</a>
                ) : (
                  <a href={`/api/admin/college-id/${found.user.id}`} target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/college-id/${found.user.id}`} alt="Student college ID" className="w-full rounded-lg border border-stone-200" />
                  </a>
                )
              ) : (
                <p className="text-sm text-stone-500">Not uploaded</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Queue */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">File</th>
              <th className="px-4 py-2.5">Pages × copies</th>
              <th className="px-4 py-2.5">Paid</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {queue.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-500">No active orders.</td></tr>
            )}
            {queue.map((o) => (
              <tr key={o.id} className={o.status === "FAILED" ? "bg-red-50/50" : ""}>
                <td className="px-4 py-2.5"><Link href={`/admin?code=${o.printingCode}`} className="font-mono font-semibold underline">{o.printingCode}</Link></td>
                <td className="px-4 py-2.5">{o.user.fullName}<div className="font-mono text-xs text-stone-500">{o.user.prn}</div></td>
                <td className="max-w-[200px] truncate px-4 py-2.5">{o.document.originalName}</td>
                <td className="px-4 py-2.5">{o.selectedPages} × {o.copies}</td>
                <td className="px-4 py-2.5">{time(o.paidAt)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={o.status} />
                  {o.status === "FAILED" && o.failureReason && <div className="mt-1 max-w-[220px] text-xs text-red-700">{o.failureReason}</div>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {o.status === "READY" && (
                    <Link href={`/admin?code=${o.printingCode}`} className="text-xs font-semibold underline">Verify &amp; hand over</Link>
                  )}
                  {o.status === "FAILED" && (
                    <form action={reprintOrder}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="text-xs font-semibold underline">Reprint</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="mb-4 font-semibold">Pricing &amp; limits</h2>
        <form action={updateSettings} className="grid gap-4 sm:grid-cols-5 sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-medium">₹ per page (B&amp;W)</span>
            <input name="rateRupees" type="number" step="0.5" min="0.5" defaultValue={settings.ratePerPagePaise / 100} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Max copies</span>
            <input name="maxCopies" type="number" min="1" max="10" defaultValue={settings.maxCopies} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Max file (MB)</span>
            <input name="maxFileMB" type="number" min="1" max="100" defaultValue={settings.maxFileMB} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Max pages</span>
            <input name="maxPages" type="number" min="1" max="2000" defaultValue={settings.maxPages} className={inputClass} />
          </label>
          <SubmitButton>Save</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="truncate text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
