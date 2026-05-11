// Unit tests for the source framework.
// Run with: deno test --allow-net --allow-env supabase/functions/_shared/source-framework.test.ts

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { defineSource, runSource } from "./source-framework.ts";

// Minimal in-memory SupabaseClient stub.
function stubSb() {
  const inserted: unknown[] = [];
  return {
    inserted,
    from(_t: string) {
      return {
        insert: async (row: unknown) => {
          inserted.push(row);
          return { error: null };
        },
        upsert: async () => ({ error: null }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      };
    },
  } as never;
}

Deno.test("defineSource validates required fields", () => {
  try {
    // deno-lint-ignore no-explicit-any
    defineSource({ slug: "", product: "x", host: "h", fetch: (async () => []) as any });
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("required"));
  }
});

Deno.test("runSource extracts rows and reports row count", async () => {
  const def = defineSource({
    slug: "test_static",
    product: "trade_radar",
    host: "example.test",
    skipCanonical: true,
    fetch: async () => ({ items: [{ a: 1 }, { a: 2 }, { a: 3 }] }),
    extractRows: (p) => (p as { items: unknown[] }).items as Record<string, unknown>[],
  });

  const result = await runSource(stubSb(), def);
  assertEquals(result.ok, true);
  assertEquals(result.rows, 3);
  assertEquals(result.slug, "test_static");
});

Deno.test("runSource normalize() transforms each row", async () => {
  let seen: unknown[] = [];
  const def = defineSource<{ x: number[] }, { x: number }>({
    slug: "test_normalize",
    product: "trade_radar",
    host: "example.test",
    skipCanonical: true,
    fetch: async () => ({ x: [10, 20] }),
    extractRows: (p) => p.x.map((x) => ({ x })),
    normalize: (r) => {
      seen.push(r);
      return { doubled: r.x * 2 };
    },
  });
  const result = await runSource(stubSb(), def);
  assertEquals(result.rows, 2);
  assertEquals(seen.length, 2);
});

Deno.test("runSource captures fetch errors without throwing", async () => {
  const def = defineSource({
    slug: "test_error",
    product: "trade_radar",
    host: "example.test",
    skipCanonical: true,
    fetch: async () => {
      throw new Error("upstream exploded");
    },
  });
  const result = await runSource(stubSb(), def);
  assertEquals(result.ok, false);
  assert(result.error?.includes("exploded"));
});
