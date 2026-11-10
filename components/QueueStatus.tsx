import { describeWait, type QueueInfo } from "@/lib/queue";

/** "2 people before you · about 6 min" — only counts, never other students' details. */
export function QueueStatus({ info, printerOnline }: { info: QueueInfo; printerOnline: boolean }) {
  if (info.printingNow) {
    return (
      <div className="rounded-xl bg-indigo-50 px-4 py-3 text-indigo-900">
        <p className="font-semibold">🖨️ Printing your order now</p>
        <p className="text-sm">Ready in {describeWait(info.minutes)}. We&apos;ll email you.</p>
      </div>
    );
  }
  const before =
    info.peopleBefore === 0 ? "You're next in line" : `${info.peopleBefore} ${info.peopleBefore === 1 ? "person" : "people"} before you`;
  return (
    <div className="rounded-xl bg-sky-50 px-4 py-3 text-sky-900">
      <p className="font-semibold">
        #{info.peopleBefore + 1} in the queue · {before}
      </p>
      <p className="text-sm">
        {printerOnline
          ? `Estimated ready ${describeWait(info.minutes)}. We'll email you.`
          : "Printer is offline right now — your place in the queue is kept."}
      </p>
    </div>
  );
}
