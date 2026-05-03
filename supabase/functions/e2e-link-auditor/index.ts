// E2E Link Auditor — HEAD-checks every outbound URL across products/channels.
// Logs results to link_audit_results. Service-role only; admin-triggered via UI or cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { OFFERS } from "../_shared/offers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Public site origin used for /start-trial CTAs
const PUBLIC_SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://detroitwebagent.com";

interface CheckTarget {
  product_key: string;
  channel: string;
  url: string;
}

function buildTargets(): CheckTarget[] {
  const targets: CheckTarget[] = [];
  for (const [key, offer] of Object.entries(OFFERS)) {
    if (!offer) continue;
    const trialUrl = `${PUBLIC_SITE}/start-trial?product=${encodeURIComponent(key)}`;
    targets.push({ product_key: key, channel: "trial-cta", url: trialUrl });
    // QR resolves to the same trial URL via QRServer
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trialUrl)}`;
    targets.push({ product_key: key, channel: "qr", url: qrUrl });
  }
  // Always check root marketing site
  targets.push({ product_key: "_root", channel: "site", url: PUBLIC_SITE });
  return targets;
}

async function checkOne(t: CheckTarget) {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(t.url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
      // Some hosts (incl. QRServer) reject HEAD — fall back to GET
      if (res.status >= 400 && res.status !== 404) {
        res = await fetch(t.url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      }
    } finally {
      clearTimeout(timer);
    }
    return {
      ...t,
      status_code: res.status,
      ok: res.status >= 200 && res.status < 400,
      response_ms: Date.now() - start,
      error: null as string | null,
    };
  } catch (e) {
    return {
      ...t,
      status_code: null as number | null,
      ok: false,
      response_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const targets = buildTargets();

    // Run in batches of 15 to respect performance memory rule
    const results: Awaited<ReturnType<typeof checkOne>>[] = [];
    for (let i = 0; i < targets.length; i += 15) {
      const batch = targets.slice(i, i + 15);
      const out = await Promise.all(batch.map(checkOne));
      results.push(...out);
    }

    const rows = results.map((r) => ({
      product_key: r.product_key,
      channel: r.channel,
      url: r.url,
      status_code: r.status_code,
      ok: r.ok,
      response_ms: r.response_ms,
      error: r.error,
    }));

    const { error: insErr } = await sb.from("link_audit_results").insert(rows);
    if (insErr) throw insErr;

    const failures = rows.filter((r) => !r.ok);
    return new Response(
      JSON.stringify({
        ok: true,
        checked: rows.length,
        failures: failures.length,
        failed_urls: failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
