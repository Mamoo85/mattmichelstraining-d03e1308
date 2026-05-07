// trial-abandonment-sweeper
// Runs on cron. Finds people who hit /start-trial, focused the form (or errored)
// 30+ minutes ago, never submitted, never got a resume email — and emails them
// a one-click resume link that pre-fills email + product.
//
// Source of truth: trial_funnel_events. State machine: trial_abandonment_state.

import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail, DWA_TEAL, DWA_BG } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_BASE = Deno.env.get("DWA_PUBLIC_URL") || "https://detroitwebagent.com";
const SWEEP_WINDOW_MIN = 30; // wait 30 min before considering abandoned
const MAX_AGE_HOURS = 48;     // don't email after 48h cold
const DAILY_CAP = 100;

// Friendly product labels (subset; falls back to humanized key)
const LABELS: Record<string, string> = {
  mortgage_radar: "Mortgage Radar",
  field_desk: "FieldDesk",
  site_radar: "SiteRadar",
  missed_call_catch: "Missed-Call Catch",
  phone_answering: "AI Phone Answering",
  bundle_revenue_suite: "Revenue Suite Bundle",
  techalert: "TechAlert",
  trade_radar_roofing: "Roofing Radar",
  trade_radar_hvac: "HVAC Radar",
  trade_radar_plumbing: "Plumbing Radar",
  trade_radar_electrical: "Electrical Radar",
  trade_radar_pest_control: "Pest Control Radar",
  trade_radar_gutters: "Gutters Radar",
  trade_radar_exterior: "Exterior Radar",
  trade_radar_tree: "Tree Radar",
  trade_radar_restoration: "Restoration Radar",
  trade_radar_demo_junk: "Demo & Junk Radar",
  trade_radar_foundation: "Foundation Radar",
};

function labelFor(key: string | null): string {
  if (!key) return "your trial";
  return LABELS[key] || key.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function buildResumeUrl(product: string | null, email: string, token: string): string {
  const url = new URL("/start-trial", PUBLIC_BASE);
  if (product) url.searchParams.set("product", product);
  url.searchParams.set("email", email);
  url.searchParams.set("resume", token);
  url.searchParams.set("utm_source", "abandoned_trial");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", "trial_resume_30m");
  return url.toString();
}

function emailHtml(productLabel: string, resumeUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:${DWA_BG};font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="color:${DWA_TEAL};font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;">Detroit Web Agency</div>
      <h1 style="font-size:24px;margin:8px 0 0;color:#fff;">You were one click away from ${productLabel}</h1>
    </div>
    <p style="color:#cbd5e1;">Hey — saw you started the ${productLabel} trial signup but didn't finish. No worries, your spot is still open.</p>
    <p style="color:#cbd5e1;">Click below and we'll have you set up in under 30 seconds. No credit card. Cancel in one click.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resumeUrl}" style="background:${DWA_TEAL};color:${DWA_BG};font-weight:bold;padding:16px 28px;border-radius:8px;text-decoration:none;display:inline-block;">Finish my trial →</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;">Hit a snag? Just reply to this email or text Matt directly: <a href="sms:+13139921219" style="color:${DWA_TEAL};">(313) 992-1219</a></p>
    <p style="color:#64748b;font-size:11px;text-align:center;margin-top:32px;">Detroit Web Agency · matt@detroitwebagent.com</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = new Date().toISOString();

  // 1) Find candidate emails from funnel events: focused form or errored, but never submitted/succeeded.
  const cutoffOld = new Date(Date.now() - SWEEP_WINDOW_MIN * 60_000).toISOString();
  const cutoffMaxAge = new Date(Date.now() - MAX_AGE_HOURS * 3600_000).toISOString();

  const { data: events, error: evErr } = await sb
    .from("trial_funnel_events")
    .select("event_type, product, email, created_at")
    .in("event_type", ["form_focus", "form_submit", "trial_error", "view"])
    .gte("created_at", cutoffMaxAge)
    .lte("created_at", cutoffOld)
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (evErr) {
    return new Response(JSON.stringify({ ok: false, error: evErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group by email+product, find latest event per pair, exclude any that succeeded
  type Key = string;
  const latest = new Map<Key, { email: string; product: string | null; lastEvent: string; lastAt: string; succeeded: boolean }>();
  for (const e of events ?? []) {
    const email = (e.email as string).trim().toLowerCase();
    const product = (e.product as string) || null;
    const k = `${email}|${product || ""}`;
    const cur = latest.get(k);
    if (!cur) {
      latest.set(k, { email, product, lastEvent: e.event_type, lastAt: e.created_at, succeeded: false });
    }
    if (e.event_type === "trial_success" || e.event_type === "checkout_redirect" || e.event_type === "form_submit") {
      const v = latest.get(k);
      if (v && e.event_type !== "form_submit") v.succeeded = true;
    }
  }

  // Also check for any successful submits in the same window — exclude those emails
  const { data: completedRows } = await sb
    .from("trial_funnel_events")
    .select("email, product")
    .in("event_type", ["trial_success", "checkout_redirect"])
    .gte("created_at", cutoffMaxAge);
  const completedSet = new Set<string>(
    (completedRows ?? []).map((r: any) => `${(r.email || "").trim().toLowerCase()}|${r.product || ""}`)
  );

  // 2) For each candidate: ensure abandonment_state row, skip if already emailed/completed/blocked.
  let sent = 0, skipped = 0, errors = 0;
  const traces: any[] = [];

  for (const { email, product, lastEvent, lastAt } of latest.values()) {
    if (sent >= DAILY_CAP) break;
    const k = `${email}|${product || ""}`;
    if (completedSet.has(k)) { skipped++; continue; }
    if (lastEvent === "form_submit" || lastEvent === "trial_success" || lastEvent === "checkout_redirect") {
      skipped++; continue;
    }

    // Check existing state
    const { data: existing } = await sb
      .from("trial_abandonment_state")
      .select("id, resume_token, emailed_at, completed_at")
      .eq("email", email)
      .eq("product", product)
      .maybeSingle();

    if (existing?.completed_at || existing?.emailed_at) { skipped++; continue; }

    // Blocklist check (suppression / unsubscribes)
    let blocked = false;
    try { blocked = await isBlocked(sb, email); } catch { /* fail open */ }
    if (blocked) { skipped++; traces.push({ email, reason: "blocked" }); continue; }

    // Upsert state
    let token: string;
    if (existing) {
      token = existing.resume_token;
      await sb.from("trial_abandonment_state")
        .update({ last_event: lastEvent, last_event_at: lastAt })
        .eq("id", existing.id);
    } else {
      const { data: ins, error: insErr } = await sb
        .from("trial_abandonment_state")
        .insert({ email, product, last_event: lastEvent, last_event_at: lastAt })
        .select("id, resume_token")
        .single();
      if (insErr || !ins) { errors++; traces.push({ email, reason: insErr?.message || "insert_failed" }); continue; }
      token = ins.resume_token;
    }

    // Send email
    const productLabel = labelFor(product);
    const resumeUrl = buildResumeUrl(product, email, token);
    const result = await dwaEmail({
      to: email,
      subject: `You were one click away from ${productLabel} — finish in 30 sec`,
      html: emailHtml(productLabel, resumeUrl),
    });

    if (result.ok) {
      await sb.from("trial_abandonment_state")
        .update({ emailed_at: new Date().toISOString() })
        .eq("email", email)
        .eq("product", product);
      sent++;
      traces.push({ email, product, sent: true });
    } else {
      errors++;
      traces.push({ email, product, error: result.error });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    started_at: startedAt,
    candidates: latest.size,
    sent, skipped, errors,
    traces: traces.slice(0, 50),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
