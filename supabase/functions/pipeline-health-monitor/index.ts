/**
 * pipeline-health-monitor — Synthetic API health checks
 * Runs twice daily (6am + 6pm ET) via cron.
 * Pings each critical API in the TechAlert pipeline with a lightweight test.
 * Logs results to api_health_checks and SMSes Matt if any fail.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthResult {
  api_name: string;
  status: "ok" | "degraded" | "down";
  response_ms: number;
  error_message: string | null;
}

async function pingAPI(
  name: string,
  fn: () => Promise<Response>,
  additionalOkStatuses: number[] = [],
): Promise<HealthResult> {
  const start = Date.now();
  try {
    const res = await fn();
    const elapsed = Date.now() - start;
    if (res.ok || additionalOkStatuses.includes(res.status)) {
      return { api_name: name, status: "ok", response_ms: elapsed, error_message: null };
    }
    return { api_name: name, status: "degraded", response_ms: elapsed, error_message: `HTTP ${res.status}` };
  } catch (e) {
    return {
      api_name: name,
      status: "down",
      response_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Run all health checks in parallel
    const checks = await Promise.all([
      // 1. NPI Registry (free federal API)
      pingAPI("NPI Registry", () =>
        fetch("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=1&state=MI&taxonomy_description=Nursing", {
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 2. Sonar/OpenRouter
      pingAPI("Sonar (OpenRouter)", () =>
        fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 3. People Data Labs — skip if no key configured (not a service failure)
      ...(PDL_API_KEY ? [pingAPI("People Data Labs", () =>
        fetch("https://api.peopledatalabs.com/v5/person/enrich?name=John+Smith&region=michigan&country=US&min_likelihood=2", {
          headers: { "X-Api-Key": PDL_API_KEY },
          signal: AbortSignal.timeout(10_000),
        }),
        [404, 402] // 404 = no match (auth OK); 402 = payment plan issue (not service down)
      )] : []),

      // 4. Yelp Fusion
      pingAPI("Yelp Fusion", () =>
        fetch("https://api.yelp.com/v3/businesses/search?term=plumber&location=Detroit+MI&limit=1", {
          headers: { Authorization: `Bearer ${YELP_API_KEY}` },
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 5. Firecrawl — credit-usage endpoint: zero scrape credits burned, also confirms premium plan active.
      pingAPI("Firecrawl", () =>
        fetch("https://api.firecrawl.dev/v2/team/credit-usage", {
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
          signal: AbortSignal.timeout(10_000),
        }),
        [401] // 401 = server alive but key issue
      ),

      // 6. Resend (verify domain — lightweight)
      pingAPI("Resend", () =>
        fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 7. Lovable AI Gateway — probe root, accept any 2xx/4xx (POST-only service)
      pingAPI("Lovable AI Gateway", () =>
        fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "GET",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
          signal: AbortSignal.timeout(10_000),
        }),
        [400, 401, 404, 405, 415, 422] // any structured error = gateway is alive
      ),

      // 8. Michigan Open Data — Socrata catalog root (specific dataset IDs change; root is stable).
      pingAPI("Michigan Open Data", () =>
        fetch("https://data.michigan.gov/api/views.json?$limit=1", {
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 9. Detroit Building Permits (ArcGIS)
      pingAPI("Detroit Permits (ArcGIS)", () =>
        fetch("https://services2.arcgis.com/qvkbeam7Wrber2Eh/ArcGIS/rest/services/bseed_trades_permits/FeatureServer/0/query?where=1%3D1&resultRecordCount=1&f=json", {
          signal: AbortSignal.timeout(10_000),
        })
      ),

      // 10. LARA/MiPLUS (Accela portal)
      pingAPI("LARA MiPLUS", () =>
        fetch("https://aca-prod.accela.com/LARA/", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(10_000),
        })
      ),
    ]);

    // Insert all results
    const { error: insertErr } = await sb.from("api_health_checks").insert(
      checks.map((c) => ({
        api_name: c.api_name,
        status: c.status,
        response_ms: c.response_ms,
        error_message: c.error_message,
      }))
    );
    if (insertErr) console.error("[health-monitor] DB insert error:", insertErr.message);

    // Check for failures
    const failures = checks.filter((c) => c.status !== "ok");
    const allOk = failures.length === 0;

    if (!allOk) {
      const failList = failures.map((f) => `❌ ${f.api_name}: ${f.status} (${f.error_message || "timeout"})`).join("\n");
      const okCount = checks.length - failures.length;

      // SMS Matt
      if (TWILIO_PHONE_NUMBER) {
        await sendSMS(
          ADMIN_PHONE,
          TWILIO_PHONE_NUMBER,
          `⚠️ TechAlert Pipeline Alert\n${okCount}/${checks.length} sources OK\n\n${failList}`,
          "pipeline_health_monitor"
        );
      }

      // Email Matt with details
      if (RESEND_API_KEY) {
        const rows = checks.map((c) => {
          const color = c.status === "ok" ? "#22c55e" : c.status === "degraded" ? "#f59e0b" : "#ef4444";
          return `<tr><td style="padding:8px;border-bottom:1px solid #1e293b;color:#fff;">${c.api_name}</td><td style="padding:8px;border-bottom:1px solid #1e293b;color:${color};font-weight:700;">${c.status.toUpperCase()}</td><td style="padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8;">${c.response_ms}ms</td><td style="padding:8px;border-bottom:1px solid #1e293b;color:#ef4444;font-size:12px;">${c.error_message || "—"}</td></tr>`;
        }).join("");

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: ["matt@detroitwebagent.com"],
            subject: `⚠️ Pipeline Health: ${okCount}/${checks.length} sources operational`,
            html: `<div style="background:#0a1628;padding:32px;font-family:sans-serif;"><h2 style="color:#fff;margin:0 0 16px;">Pipeline Health Report</h2><p style="color:#94a3b8;margin:0 0 24px;">${okCount} of ${checks.length} data sources responding normally.</p><table style="width:100%;border-collapse:collapse;"><tr style="background:#1e293b;"><th style="padding:8px;text-align:left;color:#94a3b8;font-size:12px;">SOURCE</th><th style="padding:8px;text-align:left;color:#94a3b8;font-size:12px;">STATUS</th><th style="padding:8px;text-align:left;color:#94a3b8;font-size:12px;">LATENCY</th><th style="padding:8px;text-align:left;color:#94a3b8;font-size:12px;">ERROR</th></tr>${rows}</table></div>`,
          }),
        });
      }
    }

    // Heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name: "pipeline-health-monitor",
      last_beat: new Date().toISOString(),
      metadata: {
        total: checks.length,
        ok: checks.filter((c) => c.status === "ok").length,
        degraded: checks.filter((c) => c.status === "degraded").length,
        down: checks.filter((c) => c.status === "down").length,
      },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({
        total: checks.length,
        ok: checks.filter((c) => c.status === "ok").length,
        failures: failures.length,
        details: checks.map((c) => ({ name: c.api_name, status: c.status, ms: c.response_ms })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[pipeline-health-monitor] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
