import { requireUser } from "@/lib/auth";
import { getPrinterStatus, getSettings } from "@/lib/settings";
import { Alert, PageTitle } from "@/components/ui";
import { PrintForm } from "./PrintForm";

export default async function PrintPage() {
  await requireUser();
  const [settings, printer] = await Promise.all([getSettings(), getPrinterStatus()]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Print a document" subtitle="Upload a PDF, choose pages and copies, then pay." />
      {!settings.acceptingOrders ? (
        <Alert kind="warning">The print desk isn&apos;t accepting new orders right now. Please check back later.</Alert>
      ) : (
        <>
          {!printer.online && (
            <div className="mb-4">
              <Alert kind="warning">The printer is offline at the moment. You can still order — it will print as soon as it&apos;s back.</Alert>
            </div>
          )}
          <PrintForm
            ratePaise={settings.ratePerPagePaise}
            maxCopies={settings.maxCopies}
            maxFileMB={settings.maxFileMB}
            maxPages={settings.maxPages}
          />
        </>
      )}
    </div>
  );
}
