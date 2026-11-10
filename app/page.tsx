import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { getPrinterStatus, getSettings } from "@/lib/settings";
import { formatRupees } from "@/lib/pricing";
import { buttonClass, secondaryButtonClass } from "@/components/ui";

export default async function Home() {
  const [user, settings, printer] = await Promise.all([getCurrentUser(), getSettings(), getPrinterStatus()]);
  if (user) redirect(homePathFor(user));

  const steps = [
    ["Upload your PDF", `Up to ${settings.maxFileMB} MB and ${settings.maxPages} pages.`],
    ["Pick pages & copies", `Black & white on A4 · ${formatRupees(settings.ratePerPagePaise)} per page · up to ${settings.maxCopies} copies.`],
    ["Pay with UPI", "Scan the Razorpay QR or pay with any UPI app, card or netbanking."],
    ["Collect with your code", "We email you when it's ready. Show your code and college ID at the desk."],
  ];

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${printer.online ? "bg-emerald-500" : "bg-stone-400"}`} />
            {printer.online ? "Printer online" : "Printer offline — orders will print when it's back"}
            {!settings.acceptingOrders && " · not accepting orders right now"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Skip the print queue.</h1>
          <p className="mt-4 max-w-md text-lg text-stone-600">
            Upload your PDF from anywhere, pay online, and pick up your prints from the desk when we tell you they&apos;re ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link href="/print" className={buttonClass}>Print a document</Link>
                <Link href="/orders" className={secondaryButtonClass}>My orders</Link>
              </>
            ) : (
              <>
                <Link href="/signup" className={buttonClass}>Create account</Link>
                <Link href="/login" className={secondaryButtonClass}>Log in</Link>
              </>
            )}
          </div>
        </div>
        <ol className="space-y-3">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-stone-600">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
