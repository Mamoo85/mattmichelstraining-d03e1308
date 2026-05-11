/**
 * scanner-monitor-alert
 * =====================
 * End-to-end monitoring sweep for every scanner run (framework + extras).
 *
 * Runs on a 15-min cron. Reads `v_scanner_runs_unified`, classifies issues into
 * three buckets, opens/updates rows in `scanner_alerts`, and pages Matt via SMS
 * + `error_logs` on first detection.
 *
 *  CRITICAL — source has produced zero successful runs in 24h
 *  ERROR    — ≥3 consecutive failures or single hard failure (HTTP 5xx, AUTH)
 *  WARN     — error rate >50% over last hour (≥4 runs)
 *
 * Dedupe: one open `scanner_alerts` row per (product|source|reason|error_code).
 * SMS sent only when `alerted_at IS NULL`. Resolve once a successful run lands.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "+13139921219";

type Severity = "warn" | "error" | "critical";

interface UnifiedRun {
  engine: string;
  source: string;
  product: string;
  ok: boolean;
  rows: number;
  duration_ms: number;
  error: string | null;
  failing_step: string | null;
  error_code: string | null;
  ran_at: string;
}

interface Issue {
  product: string;
  source: string;
  severity: Severity;
  reason: string;
  error_code: string;
  failing_step: string;
  detail: string;
}

function fingerprint(p: string, s: string, reason: string, code: string): string {
  return `${p}::${s}::${reason}::${code}`;
}

function fmtET(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Detroit",
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true,
  }) + " ET";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = Date.now();
  const SINCE_24H = new Date(now - 24 * 3600_000).toISOString();
  const SINCE_1H = new Date(now - 3600_000).toISOString();

  // ── Pull last 24h of unified runs ────────────────────────────────────────
  const { data: runs, error: runsErr } = await sb
    .from("v_scanner_runs_unified")
    .select("*")
    .gte("ran_at", SINCE_24H)
    .order("ran_at", { ascending: false })
    .limit(5000);

  if (runsErr) {
    return new Response(JSON.stringify({ error: runsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Group runs by (product, source) ──────────────────────────────────────
  const groups = new Map<string, UnifiedRun[]>();
  for (const r of (runs ?? []) as UnifiedRun[]) {
    const k = `${r.product}::${r.source}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const issues: Issue[] = [];
  for (const [, arr] of groups) {
    arr.sort((a, b) => +new Date(b.ran_at) - +new Date(a.ran_at));
    const latest = arr[0];
    const { product, source } = latest;
    const ok24h = arr.filter((r) => r.ok).length;
    const last1h = arr.filter((r) => +new Date(r.ran_at) >= +new Date(SINCE_1H));
    const errRate1h = last1h.length ? last1h.filter((r) => !r.ok).length / last1h.length : 0;

    // Consecutive failures from the top
    let consecFails = 0;
    for (const r of arr) { if (!r.ok) consecFails++; else break; }

    // CRITICAL — fully dark for 24h
    if (ok24h === 0 && arr.length > 0) {
      const code = latest.error_code ?? "UNKNOWN";
      issues.push({
        product, source, severity: "critical",
        reason: "no_successful_runs_24h",
        error_code: code,
        failing_step: latest.failing_step ?? "fetch",
        detail: `${arr.length} attempts, 0 successes in 24h. Last error: ${latest.error ?? "n/a"} @ ${fmtET(latest.ran_at)}`,
      });
      continue;
    }

    // ERROR — 3+ consecutive failures OR single hard failure
    const hardCodes = new Set(["AUTH", "HTTP_401", "HTTP_403", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504"]);
    if (consecFails >= 3 || (consecFails >= 1 && hardCodes.has(latest.error_code ?? ""))) {
      issues.push({
        product, source, severity: "error",
        reason: consecFails >= 3 ? "consecutive_failures" : "hard_failure",
        error_code: latest.error_code ?? "UNKNOWN",
        failing_step: latest.failing_step ?? "fetch",
        detail: `${consecFails} failure(s) in a row. ${latest.error ?? ""} @ ${fmtET(latest.ran_at)}`,
      });
      continue;
    }

    // WARN — sustained error rate
    if (last1h.length >= 4 && errRate1h > 0.5) {
      issues.push({
        product, source, severity: "warn",
        reason: "high_error_rate_1h",
        error_code: latest.error_code ?? "MIXED",
        failing_step: latest.failing_step ?? "fetch",
        detail: `${Math.round(errRate1h * 100)}% error rate over ${last1h.length} runs in last hour`,
      });
    }
  }

  // ── Upsert issues into scanner_alerts (dedup by fingerprint) ─────────────
  let opened = 0, paged = 0;
  for (const it of issues) {
    const fp = fingerprint(it.product, it.source, it.reason, it.error_code);
    const { data: existing } = await sb
      .from("scanner_alerts")
      .select("*")
      .eq("fingerprint", fp)
      .is("resolved_at", null)
      .maybeSingle();

    if (existing) {
      await sb.from("scanner_alerts").update({
        last_seen_at: new Date().toISOString(),
        occurrences: (existing.occurrences ?? 1) + 1,
        failing_step: it.failing_step,
        error_code: it.error_code,
      }).eq("id", existing.id);
      continue;
    }

    const ins = await sb.from("scanner_alerts").insert({
      fingerprint: fp,
      product: it.product,
      source: it.source,
      severity: it.severity,
      reason: it.reason,
      error_code: it.error_code,
      failing_step: it.failing_step,
    }).select("id").single();

    if (ins.error) continue;
    opened++;

    // Page Matt for new error+critical
    if (it.severity === "warn") continue;

    const body =
      `🛰️ Scanner ${it.severity.toUpperCase()}\n` +
      `${it.product} / ${it.source}\n` +
      `step=${it.failing_step} code=${it.error_code}\n` +
      `${it.detail.slice(0, 220)}\n` +
      `→ /dwa-admin/scanner-monitoring`;

    try {
      const r = await sendSMS(ADMIN_PHONE, TWILIO_FROM, body, "scanner-monitor");
      if (r.ok) {
        paged++;
        await sb.from("scanner_alerts").update({ alerted_at: new Date().toISOString() }).eq("id", ins.data!.id);
      }
    } catch (e) {
      console.warn("SMS failed:", (e as Error).message);
    }

    await logError({
      source: "cron",
      function_name: "scanner-monitor-alert",
      severity: it.severity,
      error_message: `${it.product}/${it.source}: ${it.reason} [${it.error_code}@${it.failing_step}] — ${it.detail}`,
      payload: it,
    }).catch(() => {});
  }

  // ── Auto-resolve open alerts that now have a recent success ─────────────
  const { data: openAlerts } = await sb
    .from("scanner_alerts")
    .select("id, product, source")
    .is("resolved_at", null);

  let resolved = 0;
  for (const a of (openAlerts ?? [])) {
    const k = `${a.product}::${a.source}`;
    const runsForPair = groups.get(k);
    if (runsForPair && runsForPair[0]?.ok) {
      await sb.from("scanner_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", a.id);
      resolved++;
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    generated_at_et: fmtET(new Date().toISOString()),
    runs_inspected: runs?.length ?? 0,
    issues_found: issues.length,
    new_alerts_opened: opened,
    sms_paged: paged,
    auto_resolved: resolved,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
