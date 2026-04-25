/**
 * fetchWithRetry — honours HTTP 429 Retry-After and backs off exponentially.
 * Drop-in around fetch() for every external Data Provider call.
 *
 * Usage:
 *   import { fetchWithRetry } from "../_shared/fetch-with-retry.ts";
 *   const res = await fetchWithRetry(url, init, { label: "OpenRouter", maxRetries: 3 });
 */
export interface RetryOptions {
  maxRetries?: number;   // default 3
  baseDelayMs?: number;  // default 1_000 — doubles each attempt
  label?: string;        // log prefix, e.g. "Twilio" or "OpenRouter"
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const max = opts.maxRetries ?? 3;
  const base = opts.baseDelayMs ?? 1_000;
  const label = opts.label ?? "DataProvider";

  for (let attempt = 0; attempt <= max; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    if (attempt === max) {
      console.warn(`[${label}] System Handshake rate-limited (429) — max retries exhausted`);
      return res; // return 429 so caller can handle
    }

    const retryAfterSec = Number(res.headers.get("Retry-After") || 0);
    const delay = retryAfterSec > 0
      ? retryAfterSec * 1_000
      : Math.min(base * Math.pow(2, attempt), 30_000); // cap at 30s

    console.warn(
      `[${label}] Ingestion Pipeline rate-limited (429) — ` +
      `retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${max})`,
    );
    await new Promise((r) => setTimeout(r, delay));
  }
  /* istanbul ignore next */
  throw new Error(`[${label}] Unreachable after ${max} retries`);
}
