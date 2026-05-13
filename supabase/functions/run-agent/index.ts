// run-agent — unified one-click invoker for the admin Agent Toolkit
// Logs every run to agent_run_log for visibility.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Whitelist of agents that can be invoked from the toolkit.
const AGENTS: Record<string, { fn: string; label: string; defaultBody?: Record<string, unknown> }> = {
  tom:                  { fn: "tom-autonomous",          label: "Tom — web design lead hunter" },
  vera:                 { fn: "vera-lead-scorer",        label: "Vera — lead qualifier" },
  hire_scanner:         { fn: "hire-alert-scanner",      label: "TechAlert / HireRadar scanner" },
  industrial_intel:     { fn: "industrial-growth-intel", label: "Industrial Growth Intel" },
  medicare_intel:       { fn: "medicare-staffing-intel", label: "Medicare Staffing Intel" },
  contractor_prospector:{ fn: "contractor-prospector",   label: "Contractor Prospector (dead-lead pitch)" },
  dead_lead_drip:       { fn: "dead-lead-drip",          label: "Dead Lead Drip (run now)" },
  dwa_operator:         { fn: "dwa-operator",            label: "DWA Operator (campaign auto-tune)" },
  dwa_closer:           { fn: "dwa-closer",              label: "DWA Closer (warm prospect bundle pitch)" },
  oz:                   { fn: "oz-autonomous",           label: "Oz — growth & ops" },
  scarlett:             { fn: "scarlett-autonomous",     label: "Scarlett — creative marketing" },
  selma:                { fn: "selma-autonomous",        label: "Selma — head of marketing" },
  dol_labor_stats:      { fn: "dol-labor-stats",         label: "DOL Labor Stats — Detroit trade shortages" },
  techalert_prospect_hunter: { fn: "techalert-prospect-hunter", label: "TechAlert Prospect Hunter (HVAC/boiler shops hiring)" },
};

async function callFunction(fnName: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep as text */ }
  return { ok: res.ok, status: res.status, body: json ?? text };
}

function summarize(result: unknown): { count: number | null; summary: string } {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    const candidates = [
      "totalDeadLeadEmailed", "candidates_found", "new_candidates",
      "alerts_sent", "leads_contacted", "drip1", "sent", "count",
      "results", "prospects",
    ];
    for (const k of candidates) {
      const v = r[k];
      if (typeof v === "number") return { count: v, summary: `${k}=${v}` };
      if (Array.isArray(v)) return { count: v.length, summary: `${k}: ${v.length}` };
    }
    const json = JSON.stringify(r);
    return { count: null, summary: json.length > 200 ? json.slice(0, 200) + "…" : json };
  }
  const str = String(result ?? "");
  return { count: null, summary: str.length > 200 ? str.slice(0, 200) + "…" : str };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let agent = "";
  let payload: Record<string, unknown> = {};
  try {
    const body = await req.json();
    agent = String(body.agent || "");
    payload = (body.payload as Record<string, unknown>) || {};
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const def = AGENTS[agent];
  if (!def) {
    return new Response(JSON.stringify({ error: `Unknown agent: ${agent}`, available: Object.keys(AGENTS) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  const { data: logRow } = await supabase.from("agent_run_log").insert({
    agent_name: def.fn,
    status: "running",
    payload,
  }).select("id").single();

  try {
    const result = await callFunction(def.fn, { ...(def.defaultBody || {}), ...payload });
    const duration = Date.now() - start;
    const { count, summary } = summarize(result.body);

    if (logRow?.id) {
      await supabase.from("agent_run_log").update({
        status: result.ok ? "succeeded" : "failed",
        result_count: count,
        result_summary: summary,
        error_message: result.ok ? null : `HTTP ${result.status}: ${typeof result.body === "string" ? result.body : JSON.stringify(result.body)}`.slice(0, 500),
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }).eq("id", logRow.id);
    }

    return new Response(JSON.stringify({
      ok: result.ok,
      agent: def.fn,
      label: def.label,
      duration_ms: duration,
      result_count: count,
      result_summary: summary,
      raw: result.body,
    }), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logRow?.id) {
      await supabase.from("agent_run_log").update({
        status: "failed",
        error_message: msg.slice(0, 500),
        duration_ms: Date.now() - start,
        completed_at: new Date().toISOString(),
      }).eq("id", logRow.id);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
