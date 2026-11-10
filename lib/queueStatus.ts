import "server-only";
import { db } from "@/lib/db";
import { queueInfo, type QueueInfo, type QueueJob } from "@/lib/queue";

/** Queue info for the given orders (the caller's own). Reads only non-identifying fields of other jobs. */
export async function queueInfoFor(orderIds: string[]): Promise<Map<string, QueueInfo>> {
  const result = new Map<string, QueueInfo>();
  if (orderIds.length === 0) return result;
  const live = (await db.order.findMany({
    where: { status: { in: ["PAID", "PRINTING"] } },
    select: { id: true, status: true, paidAt: true, selectedPages: true, copies: true },
  })) as QueueJob[];
  for (const id of orderIds) {
    const mine = live.find((j) => j.id === id);
    if (mine) result.set(id, queueInfo(mine, live));
  }
  return result;
}
