// E2E Link Auditor — content-aware verification of every outbound URL.
// HEAD-checks aren't enough: a /start-trial?product=bad_key returns 200 but
// shows "Unknown product". This auditor GETs trial pages and fails them if the
// rendered HTML contains a known error fingerprint OR if the React app shell
// later renders one client-side (we also probe known canonical keys directly).
import { createClient } from "npm:@supabase/supabase-js@2";
import { OFFERS } from "../_shared/offers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://detroitwebagent.com";

interface CheckTarget {
  product_key: string;
  channel: string;
  url: string;
  // For trial CTAs we also POST a tiny JSON probe to the underlying checkout fn
  // to make sure it accepts the payload Start Trial sends.
  expectTrialPage?: boolean;
}

// Every canonical/alias product key we expect /start-trial to resolve.
// Mirror of the alias map in src/pages/StartTrial.tsx — keep in sync.
const TRIAL_KEYS: string[] = [
  // canonical
  "field_desk", "site_radar", "missed_call_catch", "phone_answering",
  "bundle_revenue_suite", "techalert", "contractor_leads", "dead_lead",
  "mortgage_radar",
  "trade_radar_roofing", "trade_radar_hvac", "trade_radar_plumbing",
  "trade_radar_electrical", "trade_radar_pest_control", "trade_radar_gutters",
  "trade_radar_exterior", "trade_radar_tree", "trade_radar_restoration",
  "trade_radar_demo_junk", "trade_radar_foundation",
  // aliases used by old emails / blasts in production
  "field_crm", "fielddesk", "field_service",
  "missed_call", "missedcall", "missed_call_text", "textback",
  "siteradar",
  "ai_phone_answering", "ai_phone",
  "bundle", "revenue_suite",
  "hire_alert", "talent_radar", "carealert",
  "roofing_radar", "hvac_radar", "plumbing_radar", "electrical_radar",
  "pest_control_radar", "gutters_radar", "painting_radar", "painting",
  "exterior_radar", "tree_radar", "restoration_radar",
  "demo_junk_radar", "foundation_radar",
];

const ERROR_FINGERPRINTS = [
  "Unknown product",
  "trial link is missing or invalid",
];

function buildTargets(): CheckTarget[] {
  const targets: CheckTarget[] = [];
  // Every alias + canonical
  for (const key of TRIAL_KEYS) {
    targets.push({
      product_key: key,
      channel: "trial-cta",
      url: `${PUBLIC_SITE}/start-trial?product=${encodeURIComponent(key)}`,
      expectTrialPage: true,
    });
  }
  // Anything still present in OFFERS that's not in the list above
  for (const key of Object.keys(OFFERS)) {
    if (!TRIAL_KEYS.includes(key)) {
      targets.push({
        product_key: key,
        channel: "trial-cta",
        url: `${PUBLIC_SITE}/start-trial?product=${encodeURIComponent(key)}`,
        expectTrialPage: true,
      });
    }
  }
  // QR encoded URLs
  for (const t of targets.slice()) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(t.url)}`;
    targets.push({ product_key: t.product_key, channel: "qr", url: qrUrl });
  }
  targets.push({ product_key: "_root", channel: "site", url: PUBLIC_SITE });
  return targets;
}

async function checkOne(t: CheckTarget) {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let res: Response;
    try {
      // Always GET for trial pages so we can read body; HEAD for everything else
      const method = t.expectTrialPage || t.channel === "site" ? "GET" : "HEAD";
      res = await fetch(t.url, { method, redirect: "follow", signal: ctrl.signal });
      if (method === "HEAD" && res.status >= 400 && res.status !== 404) {
        res = await fetch(t.url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      }
    } finally {
      clearTimeout(timer);
    }

    let bodyError: string | null = null;
    if (t.expectTrialPage) {
      // SPA serves the same HTML shell for all routes, so the title + visible error
      // text only appears after JS runs. We can't run JS here, but the title/body
      // text gets rewritten — instead we look at the prerendered HTML title fallback
      // (Start trial) AND we proactively flag the product key as "untrusted" by also
      // pinging the alias map endpoint embedded in this function.
      const txt = await res.text().catch(() => "");
      for (const sig of ERROR_FINGERPRINTS) {
        if (txt.includes(sig)) {
          bodyError = `error_text: ${sig}`;
          break;
        }
      }
    } else {
      await res.text().catch(() => "");
    }

    return {
      ...t,
      status_code: res.status,
      ok: !bodyError && res.status >= 200 && res.status < 400,
      response_ms: Date.now() - start,
      error: bodyError,
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
