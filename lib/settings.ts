import "server-only";
import { db } from "@/lib/db";

export async function getSettings() {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

const AGENT_OFFLINE_AFTER_MS = 60 * 1000;

/** Printer is "online" if any print agent has checked in within the last minute. */
export async function getPrinterStatus() {
  const hb = await db.agentHeartbeat.findFirst({ orderBy: { lastSeenAt: "desc" } });
  const online = Boolean(hb && Date.now() - hb.lastSeenAt.getTime() < AGENT_OFFLINE_AFTER_MS);
  return { online, lastSeenAt: hb?.lastSeenAt ?? null, printerStatus: hb?.printerStatus ?? null };
}
