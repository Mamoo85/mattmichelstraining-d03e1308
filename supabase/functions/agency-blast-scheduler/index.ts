// agency-blast-scheduler — Coordinates the daily DWA outbound pipeline.
// Invokes blast + drip edge functions in a staggered, deliverability-safe order.
// Respects the global marketing-kill-switch before firing anything.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Order matters: drips first (warm replies), then cold blasts last.
const PIPELINE: { name: string; delayMs: number }[] = [
  { name: "outreach-followup-drip", delayMs: 0 },
  { name: "multi-service-drip", delayMs: 5_000 },
  { name: "dwa-product-blast", delayMs: 10_000 },
  { name: "siteradar-cold-blast", delayMs: 15_000 },
  { name: "fielddesk-cold-blast", delayMs: 20_000 },
];

async function invoke(name: string) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: "{}",
    });
    const body = await res.text().catch(() => "");
    return { name, ok: res.ok, status: res.status, ms: Date.now() - started, body: body.slice(0, 400) };
  } catch (err) {
    return { name, ok: false, status: 0, ms: Date.now() - started, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (await isMarketingBlocked(sb)) {
    return new Response(JSON.stringify({ skipped: true, reason: "marketing_kill_switch_on" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const step of PIPELINE) {
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    results.push(await invoke(step.name));
  }

  const summary = {
    ran: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
