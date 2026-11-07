import "server-only";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";

/** Checks "Authorization: Bearer <AGENT_API_KEY>". Returns a 401 response if invalid. */
export function checkAgentAuth(req: Request): Response | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, env.agentApiKey())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
