// Sprint K — Smoke test: hit the backfill endpoint with the malformed-payload
// fixture battery. Function must never crash with an unhandled throw.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MALFORMED_PROSPECT_PAYLOADS } from "../_shared/__fixtures__/malformed-payloads.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

Deno.test({
  name: "backfill: malformed payloads never crash",
  ignore: !SUPABASE_URL || !SUPABASE_ANON,
  async fn() {
    const url = `${SUPABASE_URL}/functions/v1/contractor-outreach-enrich-backfill`;
    for (const c of MALFORMED_PROSPECT_PAYLOADS) {
      const body = c.body === null ? "null"
        : typeof c.body === "string" ? c.body
        : JSON.stringify(c.body);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, ...(c.headers ?? {}) },
        body,
      });
      const text = await res.text();
      assert(
        res.status >= 200 && res.status < 600,
        `[${c.name}] got non-HTTP status ${res.status}`,
      );
      assert(
        !text.includes("Uncaught") && !text.includes("at file://"),
        `[${c.name}] response leaked a stack trace: ${text.slice(0, 200)}`,
      );
    }
  },
});

Deno.test({
  name: "backfill: dry_run with empty body returns valid JSON",
  ignore: !SUPABASE_URL || !SUPABASE_ANON,
  async fn() {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/contractor-outreach-enrich-backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ mode: "dry_run", limit: 5 }),
    });
    const json = await res.json();
    assert(res.ok, `expected 2xx, got ${res.status}`);
    assert(typeof json.ok === "boolean", "missing ok field");
  },
});
