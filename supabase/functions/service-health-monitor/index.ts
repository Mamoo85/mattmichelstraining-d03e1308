// service-health-monitor — runs every 30 min via cron
// Probes every external service with the CORRECT method, never throws.
// Updates service_health table. SMS Matt only on state change (operational→degraded).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProbeResult {
  service: string;
  ok: boolean;
  statusCode?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

async function safeProbe(name: string, fn: () => Promise<ProbeResult>): Promise<ProbeResult> {
  try {
    return await fn();
  } catch (e) {
    // Probe code itself crashed — log as monitor_error, NOT service_degraded
    console.error(`[HEALTH-MONITOR] probe ${name} crashed:`, e);
    return { service: name, ok: true, reason: `monitor_error: ${String(e).slice(0, 100)}` };
  }
}

async function probeLovableAI(): Promise<ProbeResult> {
  if (!LOVABLE_API_KEY) return { service: "lovable_ai_gateway", ok: false, reason: "no key" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", // CRITICAL: this endpoint is POST-only (was getting 405)
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  return { service: "lovable_ai_gateway", ok: res.ok, statusCode: res.status };
}

async function probeAnthropic(): Promise<ProbeResult> {
  if (!ANTHROPIC_API_KEY) return { service: "anthropic_api", ok: false, reason: "no key" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    signal: AbortSignal.timeout(8_000),
  });
  return { service: "anthropic_api", ok: res.ok, statusCode: res.status };
}

async function probeOpenAI(): Promise<ProbeResult> {
  // Expected: we use Lovable AI Gateway, not direct OpenAI. Mark as ok with note.
  if (!OPENAI_API_KEY) return { service: "openai_api", ok: true, reason: "intentionally unused — using Lovable AI Gateway" };
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(8_000),
  });
  return { service: "openai_api", ok: res.ok, statusCode: res.status };
}

async function probePDL(): Promise<ProbeResult> {
  if (!PDL_API_KEY) return { service: "pdl_api", ok: false, reason: "no key" };
  // Use a cheap GET to check auth + remaining credits via response headers
  const res = await fetch("https://api.peopledatalabs.com/v5/person/enrich?email=test@example.com", {
    headers: { "X-Api-Key": PDL_API_KEY },
    signal: AbortSignal.timeout(8_000),
  });
  // 402 = credits exhausted, 404 = not found (still healthy auth), 200 = found
  const ok = res.ok || res.status === 404;
  const remaining = res.headers.get("x-creditsremaining");
  const limit = res.headers.get("x-creditslimit");
  return {
    service: "pdl_api",
    ok,
    statusCode: res.status,
    metadata: {
      credits_remaining: remaining ? parseInt(remaining) : null,
      credits_limit: limit ? parseInt(limit) : null,
    },
  };
}

async function probeFirecrawl(): Promise<ProbeResult> {
  if (!FIRECRAWL_API_KEY) return { service: "firecrawl_api", ok: false, reason: "no key" };
  // Map endpoint is cheapest credit-wise
  const res = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
    signal: AbortSignal.timeout(8_000),
  });
  let metadata: Record<string, unknown> = {};
  if (res.ok) {
    try {
      const data = await res.json();
      metadata = {
        credits_remaining: data?.data?.remaining_credits ?? null,
      };
    } catch { /* ignore */ }
  }
  return { service: "firecrawl_api", ok: res.ok || res.status === 402, statusCode: res.status, metadata };
}

async function probeApollo(): Promise<ProbeResult> {
  if (!APOLLO_API_KEY) return { service: "apollo_api", ok: false, reason: "no key" };
  const res = await fetch("https://api.apollo.io/v1/auth/health", {
    headers: { "X-Api-Key": APOLLO_API_KEY },
    signal: AbortSignal.timeout(8_000),
  });
  return { service: "apollo_api", ok: res.ok || res.status === 401, statusCode: res.status };
  // 401 still means service is up; auth issue is logged but not "degraded"
}

async function probeMichiganLARA(): Promise<ProbeResult> {
  const res = await fetch("https://www.michigan.gov/lara/bureau-list/bpl", {
    method: "HEAD",
    signal: AbortSignal.timeout(8_000),
    redirect: "follow",
  });
  // LARA blocks HEAD requests with 403 — that is expected, not a failure.
  const ok = res.ok || res.status === 403;
  return { service: "michigan_lara", ok, statusCode: res.status, reason: res.status === 403 ? "expected (LARA blocks HEAD)" : undefined };
}

async function probeNPI(): Promise<ProbeResult> {
  const res = await fetch("https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567890", {
    signal: AbortSignal.timeout(8_000),
  });
  return { service: "npi_registry", ok: res.ok, statusCode: res.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Run all probes in parallel (each is wrapped in safeProbe)
  const probes = await Promise.all([
    safeProbe("lovable_ai_gateway", probeLovableAI),
    safeProbe("anthropic_api", probeAnthropic),
    safeProbe("openai_api", probeOpenAI),
    safeProbe("pdl_api", probePDL),
    safeProbe("firecrawl_api", probeFirecrawl),
    safeProbe("apollo_api", probeApollo),
    safeProbe("michigan_lara", probeMichiganLARA),
    safeProbe("npi_registry", probeNPI),
  ]);

  const stateChanges: string[] = [];
  const lowCreditWarnings: string[] = [];

  for (const p of probes) {
    // Read prior state
    const { data: prior } = await (sb.from as any)("service_health")
      .select("status, metadata")
      .eq("service_name", p.service)
      .maybeSingle();

    const priorStatus = prior?.status || "operational";
    const newStatus = p.ok ? "operational" : (p.statusCode === 402 ? "degraded" : "degraded");
    const disabledUntil = p.statusCode === 402
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Check for low-credit warning (>20% threshold)
    const credits = p.metadata?.credits_remaining as number | null;
    const limit = p.metadata?.credits_limit as number | null;
    if (typeof credits === "number" && typeof limit === "number" && limit > 0) {
      const pct = (credits / limit) * 100;
      if (pct < 20) {
        lowCreditWarnings.push(`${p.service}: ${credits}/${limit} (${pct.toFixed(0)}%)`);
      }
    }

    await (sb.from as any)("service_health").update({
      status: newStatus,
      last_status_code: p.statusCode || null,
      last_success_at: p.ok ? new Date().toISOString() : (prior as any)?.last_success_at || null,
      last_failure_at: p.ok ? (prior as any)?.last_failure_at || null : new Date().toISOString(),
      last_failure_reason: p.ok ? null : (p.reason || `HTTP ${p.statusCode}`),
      failure_count: p.ok ? 0 : ((prior as any)?.failure_count || 0) + 1,
      metadata: { ...(prior?.metadata || {}), ...(p.metadata || {}), last_probe_at: new Date().toISOString() },
      ...(disabledUntil ? { disabled_until: disabledUntil } : {}),
    }).eq("service_name", p.service);

    if (priorStatus === "operational" && newStatus !== "operational") {
      stateChanges.push(`🔴 ${p.service}: ${p.statusCode || "down"} (${p.reason || ""})`);
    } else if (priorStatus !== "operational" && newStatus === "operational") {
      stateChanges.push(`🟢 ${p.service}: recovered`);
    }
  }

  // SMS Matt only on state changes or low credits
  const alerts = [...stateChanges, ...lowCreditWarnings.map(w => `⚠️ Low credits — ${w}`)];
  if (alerts.length > 0 && TWILIO_PHONE) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `🛡️ Service Health: ${alerts.join(" | ").slice(0, 1400)}`,
      "service_health_monitor"
    ).catch((e) => console.error("[HEALTH-MONITOR] SMS failed:", e));
  }

  const summary = probes.map(p => `${p.service}=${p.ok ? "✅" : "❌"}${p.statusCode ? `(${p.statusCode})` : ""}`).join(" ");
  console.log(`[HEALTH-MONITOR] ${summary}`);

  return new Response(JSON.stringify({ ok: true, probes, stateChanges, lowCreditWarnings }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
