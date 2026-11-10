/**
 * Queue position and time estimate for a student's own order.
 * The printer handles paid jobs first-paid-first-printed (see app/api/agent/claim/route.ts).
 * Only counts and page totals are used — never anyone else's details.
 */

export type QueueJob = { id: string; status: "PAID" | "PRINTING"; paidAt: Date | null; selectedPages: number; copies: number };
export type QueueInfo = { peopleBefore: number; minutes: number; printingNow: boolean };

export const SECONDS_PER_JOB = 30; // warm-up, cover page, queue handling

/** Sheets a job prints: selected pages × copies, plus one cover page. */
export const jobPages = (j: Pick<QueueJob, "selectedPages" | "copies">) => j.selectedPages * j.copies + 1;

export function pagesPerMinute(): number {
  const n = Number(process.env.PRINTER_PAGES_PER_MINUTE);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** Where `mine` stands among all live jobs (PAID + PRINTING), and roughly how long until it's done. */
export function queueInfo(mine: QueueJob, live: QueueJob[], ppm = pagesPerMinute()): QueueInfo {
  if (mine.status === "PRINTING") {
    return { peopleBefore: 0, printingNow: true, minutes: Math.max(1, Math.ceil(jobPages(mine) / ppm)) };
  }
  const mineAt = mine.paidAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const ahead = live.filter(
    (j) =>
      j.id !== mine.id &&
      (j.status === "PRINTING" ||
        (j.paidAt?.getTime() ?? Number.POSITIVE_INFINITY) < mineAt ||
        // same timestamp: keep a stable order
        ((j.paidAt?.getTime() ?? Number.POSITIVE_INFINITY) === mineAt && j.id < mine.id)),
  );
  const pages = ahead.reduce((sum, j) => sum + jobPages(j), 0) + jobPages(mine);
  const seconds = (pages / ppm) * 60 + (ahead.length + 1) * SECONDS_PER_JOB;
  return { peopleBefore: ahead.length, printingNow: false, minutes: Math.max(1, Math.ceil(seconds / 60)) };
}

export function describeWait(minutes: number): string {
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `about ${h} h${m ? ` ${m} min` : ""}`;
}
