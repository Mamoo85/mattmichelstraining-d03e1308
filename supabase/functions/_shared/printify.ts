// printify.ts — rate-limit-aware Printify API client
// Parses X-RateLimit-Remaining on every response.
// If remaining ≤ 5 → auto-waits 5s before returning.
// On 429 → exponential backoff: 1s, 4s, 16s, then throws PRINTIFY_429.
// All callers must check { ok } before using body.

export interface PrintifyResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
  rateRemaining: number | null;
}

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const BASE_URL = "https://api.printify.com";
const BACKOFF_MS = [1000, 4000, 16000];

export async function printifyFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; apiKey: string },
): Promise<PrintifyResponse<T>> {
  const { method = "GET", body, apiKey } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "m2training/1.0",
  };

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30_000),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let lastResponse: Response | null = null;

  // 429 retry loop (up to 3 attempts with exponential backoff)
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, init);

    // Parse X-RateLimit-Remaining
    const rateLimitHeader = res.headers.get("X-RateLimit-Remaining");
    const rateRemaining = rateLimitHeader !== null ? (parseInt(rateLimitHeader, 10) || null) : null;

    if (res.status === 429) {
      if (attempt < BACKOFF_MS.length) {
        await delay(BACKOFF_MS[attempt]);
        continue;
      }
      // All 3 retries exhausted
      throw new Error(`PRINTIFY_429: rate limited on ${path}`);
    }

    // Parse body
    let parsedBody: T;
    const text = await res.text();
    try {
      parsedBody = JSON.parse(text) as T;
    } catch {
      parsedBody = text as unknown as T;
    }

    // Auto-wait if rate remaining is very low
    if (rateRemaining !== null && rateRemaining <= 5) {
      await delay(5000);
    }

    if (!res.ok) {
      return { ok: false, status: res.status, body: parsedBody, rateRemaining };
    }

    return { ok: true, status: res.status, body: parsedBody, rateRemaining };
  }

  // Should never reach here, but TypeScript requires a return
  throw new Error(`PRINTIFY_429: rate limited on ${path}`);
}
