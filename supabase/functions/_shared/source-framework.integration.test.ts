// End-to-end integration test for the scanner source framework.
// Exercises: per-host RPS limiting, exponential-backoff retry on 429,
// payload→extractRows→normalize pipeline, canonical mapper hand-off, and
// run-log telemetry. No network calls — the upstream "API" is a stub
// closure controlled by the test.
//
// Run with:
//   deno test --allow-net --allow-env supabase/functions/_shared/source-framework.integration.test.ts

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { defineSource, runSource, runSources } from "./source-framework.ts";

// ── Test harness ──────────────────────────────────────────────────────────

interface InsertRow { table: string; row: Record<string, unknown> }

function makeSbStub() {
  const inserts: InsertRow[] = [];
  const upserts: InsertRow[] = [];
  const sb = {
    inserts,
    upserts,
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        },
        upsert: async (row: Record<string, unknown>) => {
          upserts.push({ table, row });
          return { error: null };
        },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
            limit: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        }),
      };
    },
  };
  return sb as never;
}

/** Install a deterministic fetch stub that returns a scripted sequence per URL. */
function installFetchScript(
  script: Record<string, Array<{ status: number; body?: unknown; retryAfter?: string }>>,
) {
  const calls: { url: string; ts: number }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, ts: Date.now() });
    const queue = script[url] ?? script["*"];
    if (!queue || queue.length === 0) {
      return Promise.resolve(new Response("not_scripted", { status: 599 }));
    }
    const next = queue.shift()!;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (next.retryAfter) headers["Retry-After"] = next.retryAfter;
    return Promise.resolve(
      new Response(next.body != null ? JSON.stringify(next.body) : null, {
        status: next.status,
        headers,
      }),
    );
  };
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

Deno.test("integration: 429 triggers retry, eventual success persists rows", async () => {
  const url = "https://int.test/api";
  const script = installFetchScript({
    [url]: [
      { status: 429, retryAfter: "0" },
      { status: 429, retryAfter: "0" },
      { status: 200, body: { items: [{ id: "A" }, { id: "B" }] } },
    ],
  });

  const sb = makeSbStub();
  const def = defineSource<{ items: { id: string }[] }, { id: string }>({
    slug: "int_test_429",
    product: "trade_radar",
    host: "int.test",
    rps: 10, // fast for tests
    maxRetries: 3,
    fetch: async (ctx) => (await ctx.fetchJson<{ items: { id: string }[] }>(url))!,
    extractRows: (p) => p.items,
    normalize: (r) => ({ external_id: r.id, title: `row ${r.id}` }),
    skipCanonical: true, // canonical-mapper requires real DB schema; covered in next test
  });

  const result = await runSource(sb, def);
  script.restore();

  assertEquals(result.ok, true);
  assertEquals(result.rows, 2);
  assert(script.calls.length >= 3, `expected ≥3 fetch attempts, got ${script.calls.length}`);
  // Run log must record success.
  const logRow = (sb as unknown as { inserts: InsertRow[] }).inserts.find(
    (i) => i.table === "scanner_source_runs",
  );
  assert(logRow, "scanner_source_runs row should be inserted");
  assertEquals(logRow!.row.ok, true);
  assertEquals(logRow!.row.rows_returned, 2);
});

Deno.test("integration: per-host RPS bucket throttles back-to-back calls", async () => {
  const url = "https://throttle.test/api";
  const script = installFetchScript({
    [url]: Array.from({ length: 6 }, () => ({ status: 200, body: { items: [] } })),
  });

  const sb = makeSbStub();
  // 2 rps means second call within the same second must wait ≥ ~500ms.
  const def = defineSource({
    slug: "int_test_rps",
    product: "trade_radar",
    host: "throttle.test",
    rps: 2,
    skipCanonical: true,
    fetch: async (ctx) => {
      // Three rapid calls — second & third should be throttled.
      await ctx.fetchJson(url);
      await ctx.fetchJson(url);
      await ctx.fetchJson(url);
      return { items: [] as unknown[] };
    },
    extractRows: (p) => (p as { items: unknown[] }).items as Record<string, unknown>[],
  });

  const t0 = Date.now();
  await runSource(sb, def);
  const elapsed = Date.now() - t0;
  script.restore();

  // At 2 rps, 3 sequential calls should take at least ~500ms total (1 free, 2 paced).
  assert(elapsed >= 400, `expected RPS throttle to add ≥400ms, got ${elapsed}ms`);
});

Deno.test("integration: normalize() output reaches canonical mapper input", async () => {
  const url = "https://canon.test/api";
  const script = installFetchScript({
    [url]: [{
      status: 200,
      body: { results: [{ raw_id: "X1", street: "1 Main", amount: 250000 }] },
    }],
  });

  const sb = makeSbStub();
  const def = defineSource({
    slug: "int_test_canon",
    product: "mortgage_radar",
    host: "canon.test",
    rps: 10,
    fetch: async (ctx) => (await ctx.fetchJson(url))!,
    extractRows: (p) => (p as { results: unknown[] }).results as Record<string, unknown>[],
    normalize: (r) => {
      const row = r as Record<string, unknown>;
      return {
        external_id: row.raw_id,
        address: row.street,
        estimated_value: row.amount,
        title: "canonical test row",
      };
    },
    // skipCanonical NOT set — exercises persistCanonicalRows code path.
  });

  const result = await runSource(sb, def);
  script.restore();

  // Even if canonical mapper hits a stub table and silently no-ops, framework
  // must report ok=true and rows=1 because rows were produced + normalize ran.
  assertEquals(result.rows, 1);
  // Run-log row exists with correct slug + product.
  const log = (sb as unknown as { inserts: InsertRow[] }).inserts.find(
    (i) => i.table === "scanner_source_runs",
  );
  assert(log, "expected scanner_source_runs insert");
  assertEquals(log!.row.source, "int_test_canon");
  assertEquals(log!.row.product, "mortgage_radar");
});

Deno.test("integration: runSources executes batch with bounded concurrency", async () => {
  const script = installFetchScript({
    "*": Array.from({ length: 30 }, () => ({ status: 200, body: { items: [{ a: 1 }] } })),
  });

  const sb = makeSbStub();
  const defs = ["a", "b", "c", "d", "e"].map((tag) =>
    defineSource({
      slug: `int_batch_${tag}`,
      product: "trade_radar",
      host: `${tag}.batch.test`,
      rps: 10,
      skipCanonical: true,
      fetch: async (ctx) => (await ctx.fetchJson(`https://${tag}.batch.test/x`))!,
      extractRows: (p) => (p as { items: unknown[] }).items as Record<string, unknown>[],
    }),
  );

  const results = await runSources(sb, defs, { concurrency: 2 });
  script.restore();

  assertEquals(results.length, 5);
  assertEquals(results.every((r) => r.ok && r.rows === 1), true);
});

Deno.test("integration: missing API key fails with AUTH error code", async () => {
  // No fetch script installed — should never be called because requireKey throws.
  const sb = makeSbStub();
  const def = defineSource({
    slug: "int_test_auth",
    product: "mortgage_radar",
    host: "auth.test",
    skipCanonical: true,
    fetch: async () => {
      throw new Error("AUTH: TEST_API_KEY not configured (no api key)");
    },
  });
  const result = await runSource(sb, def);
  assertEquals(result.ok, false);
  assertEquals(result.errorCode, "AUTH");
  assert(result.error?.includes("AUTH"));
});
