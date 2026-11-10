/**
 * Basic CSRF protection for JSON endpoints called by our own pages. A cross-site HTML form
 * can't send `Content-Type: application/json`, and browsers always send `Origin` on
 * cross-site fetches, which must match our host.
 * Returns an error Response to send back, or null if the request is fine.
 */
export function rejectUnsafeJsonRequest(req: Request): Response | null {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return Response.json({ error: "Expected a JSON request." }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!host || originHost !== host) {
      return Response.json({ error: "Request blocked." }, { status: 403 });
    }
  }
  return null;
}

/** Reads a JSON body, returning {} for anything that isn't a JSON object. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
