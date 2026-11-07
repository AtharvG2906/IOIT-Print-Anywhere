import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runMaintenance } from "@/lib/orders";

/**
 * Optional scheduled maintenance (expire unpaid orders, requeue stuck jobs, delete old files).
 * The agent heartbeat already runs this every minute; use a cron as a backup.
 * Call with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends this automatically).
 */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runMaintenance());
}
