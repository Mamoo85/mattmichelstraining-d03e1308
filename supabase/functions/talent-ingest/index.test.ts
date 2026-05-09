import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const FN_URL = `${SUPABASE_URL}/functions/v1/talent-ingest`;

Deno.test("talent-ingest — rejects unauthenticated request", async () => {
  if (!SUPABASE_URL) return; // skip if no env
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "test", candidates: [] }),
  });
  await res.text();
  // No auth → either 401 (function rejects) or 401 from gateway
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

Deno.test("talent-ingest — rejects non-service-role bearer", async () => {
  if (!SUPABASE_URL || !ANON_KEY) return;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ source: "test", candidates: [] }),
  });
  const body = await res.json().catch(() => ({}));
  assertEquals(res.status, 401);
  assertEquals(body.ok, false);
});

Deno.test("talent-ingest — CORS preflight", async () => {
  if (!SUPABASE_URL) return;
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assert(res.status === 200 || res.status === 204);
});
