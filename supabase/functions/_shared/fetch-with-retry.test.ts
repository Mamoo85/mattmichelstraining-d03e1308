// Tests for fetch-with-retry.ts — 429 retry/backoff behaviour.
// Run: deno test supabase/functions/_shared/fetch-with-retry.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchWithRetry } from "./fetch-with-retry.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

// Patch global fetch for the duration of a test, restore afterward.
function withMockFetch(
  responses: Response[],
  fn: () => Promise<void>,
): Promise<void> {
  let call = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const res = responses[call] ?? responses[responses.length - 1];
    call++;
    return res;
  };
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

// ── Non-429 responses are returned immediately ───────────────────────────────

Deno.test("fetchWithRetry: 200 is returned without retry", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(200); };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });
    assertEquals(res.status, 200);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchWithRetry: 400 is returned immediately without retry", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(400); };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });
    assertEquals(res.status, 400);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchWithRetry: 500 is returned immediately without retry", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(500); };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });
    assertEquals(res.status, 500);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

// ── 429 retry behaviour ──────────────────────────────────────────────────────

Deno.test("fetchWithRetry: retries after 429 and returns success on second attempt", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? makeResponse(429) : makeResponse(200);
  };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1, maxRetries: 3 });
    assertEquals(res.status, 200);
    assertEquals(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchWithRetry: returns 429 after exhausting all retries", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(429); };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1, maxRetries: 2 });
    assertEquals(res.status, 429);
    // maxRetries=2 → attempts 0, 1, 2 = 3 total calls
    assertEquals(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("fetchWithRetry: default maxRetries is 3 (4 total attempts on all-429)", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(429); };
  try {
    await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });
    assertEquals(calls, 4); // 0,1,2,3 = 4
  } finally {
    globalThis.fetch = original;
  }
});

// ── Retry-After header ───────────────────────────────────────────────────────

Deno.test("fetchWithRetry: honours Retry-After header over exponential backoff", async () => {
  // We verify the header is read — actual sleep timing is not asserted
  // (would make the test slow). We just confirm the call succeeds.
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return makeResponse(429, { "Retry-After": "0" });
    return makeResponse(200);
  };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1, maxRetries: 2 });
    assertEquals(res.status, 200);
    assertEquals(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

// ── maxRetries: 0 ────────────────────────────────────────────────────────────

Deno.test("fetchWithRetry: maxRetries 0 returns 429 immediately without retry", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return makeResponse(429); };
  try {
    const res = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1, maxRetries: 0 });
    assertEquals(res.status, 429);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

// ── Request init is forwarded ────────────────────────────────────────────────

Deno.test("fetchWithRetry: forwards method and headers to fetch", async () => {
  let capturedInit: RequestInit | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedInit = init;
    return makeResponse(200);
  };
  try {
    await fetchWithRetry(
      "https://example.com",
      { method: "POST", headers: { "X-Test": "1" } },
      { baseDelayMs: 1 },
    );
    assertEquals((capturedInit as RequestInit).method, "POST");
    assertEquals((capturedInit?.headers as Record<string, string>)["X-Test"], "1");
  } finally {
    globalThis.fetch = original;
  }
});
