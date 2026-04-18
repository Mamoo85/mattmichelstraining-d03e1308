/**
 * Request-ID propagation for tracing one candidate (or one scan) through
 * scanner → waterfall → scorer → alert in function_edge_logs.
 *
 * OPT-IN. Import where you want unified tracing:
 *
 *   import { newRequestId, log } from "../_shared/request-id.ts";
 *   const rid = newRequestId();
 *   log(rid, "scanner", "starting MIOSHA scan", { zip });
 */

export function newRequestId(): string {
  return crypto.randomUUID();
}

type Level = "debug" | "info" | "warn" | "error";

export function log(
  requestId: string,
  source: string,
  message: string,
  data?: Record<string, unknown>,
  level: Level = "info",
) {
  const entry = {
    rid: requestId,
    src: source,
    msg: message,
    lvl: level,
    ts: new Date().toISOString(),
    ...(data || {}),
  };
  // Single-line JSON so Logflare/Supabase log search stays grep-able by `rid`.
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * Extract or mint a request-id from inbound headers — useful when one edge
 * function calls another via pg_net or invoke().
 */
export function ridFromRequest(req: Request): string {
  return req.headers.get("x-request-id") || newRequestId();
}
