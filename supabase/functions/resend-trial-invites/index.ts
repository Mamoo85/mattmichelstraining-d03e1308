// Daily ramped re-send of trial invites to all prior prospects.
// Pulls trial_resend_queue rows in status='pending', sends a DWA-branded
// "we built this for you" email, then marks status='sent'.
// Honors suppression lists at send time (defense-in-depth).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { dwaEmail, DWA_TEAL, DWA_BG } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://detroitwebagent.com";
const DAILY_CAP = Number(Deno.env.get("TRIAL_RESEND_DAILY_CAP") ?? "50");

const PRODUCT_COPY: Record<string, { label: string; pitch: string }> = {
  mortgage_radar:           { label: "Mortgage Radar",   pitch: "real-time refi/listing/probate signals for loan officers — 7-day free trial, no credit card." },
  trade_radar_roofing:      { label: "Roofing Radar",    pitch: "hail/storm + permit alerts for roofers in your ZIPs — 7-day free trial, no credit card." },
  trade_radar_hvac:         { label: "HVAC Radar",       pitch: "aging-system + heat/cold extremes signals for HVAC pros — 7-day free trial, no credit card." },
  trade_radar_plumbing:     { label: "Plumbing Radar",   pitch: "permit + lead-line + flood signals for plumbers — 7-day free trial, no credit card." },
  trade_radar_electrical:   { label: "Electrical Radar", pitch: "panel-upgrade + new-build signals for electricians — 7-day free trial, no credit card." },
  trade_radar_pest_control: { label: "Pest Control Radar", pitch: "vacancy + 311 rodent signals for pest control — 7-day free trial, no credit card." },
  trade_radar_gutters:      { label: "Gutter Radar",     pitch: "storm + roof-permit signals for gutter installers — 7-day free trial, no credit card." },
  trade_radar_exterior:     { label: "Exterior Radar",   pitch: "siding/window/paint signals + storm damage zones — 7-day free trial, no credit card." },
  trade_radar_tree:         { label: "Tree Radar",       pitch: "wind/storm alerts + 311 tree calls — 7-day free trial, no credit card." },
  trade_radar_restoration:  { label: "Restoration Radar", pitch: "fire/flood/water-damage permits and incidents — 7-day free trial, no credit card." },
  trade_radar_demo_junk:    { label: "Demo & Junk Radar", pitch: "demo permits, estate sales, probate filings — 7-day free trial, no credit card." },
  trade_radar_foundation:   { label: "Foundation Radar", pitch: "flood + structural permit signals — 7-day free trial, no credit card." },
  techalert:                { label: "TechAlert",        pitch: "hiring-radar for trade & industrial firms — see who's about to staff up." },
  missed_call_catch:        { label: "Missed-Call Catch", pitch: "auto-text every missed call so you stop losing customers — 7-day free trial." },
  site_radar:               { label: "SiteRadar",        pitch: "see which companies visit your website — 7-day free trial, no credit card." },
};

function buildHtml(p: { product_key: string; product_label: string; business_name: string | null; email: string }) {
  const copy = PRODUCT_COPY[p.product_key] ?? PRODUCT_COPY.site_radar;
  const url = `${SITE_URL}/start-trial?product=${encodeURIComponent(p.product_key)}&rcpt=${encodeURIComponent(p.email)}&utm_source=trial_resend&utm_medium=email&utm_campaign=catchup_2026_05`;
  const greeting = p.business_name ? `Hey ${p.business_name},` : "Hey,";
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1628;background:#fff">
  <div style="background:${DWA_BG};color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="color:${DWA_TEAL};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Detroit Web Agency</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${copy.label} is live — your trial is ready</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">${greeting}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">
      We've talked before — back then I didn't have a free trial to give you. I do now.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55">
      <strong>${copy.label}</strong> — ${copy.pitch}
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55">
      Takes 60 seconds to start. No credit card. You'll see the signals running in your area within the day.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${url}" style="display:inline-block;background:${DWA_TEAL};color:${DWA_BG};font-weight:800;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px">Start my free trial →</a>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;line-height:1.5">
      If it's a swing-and-a-miss, just hit reply with "stop" — I'll never email again.
    </p>
    <p style="margin:18px 0 0;font-size:14px;line-height:1.55">— Matt Michels<br/>Detroit Web Agency · (313) 992-1219</p>
  </div>
</div>`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const cap = Math.max(1, Math.min(Number(body?.limit ?? DAILY_CAP), 200));

  const { data: rows, error } = await sb
    .from("trial_resend_queue")
    .select("id, email, business_name, product_key, product_label")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(cap);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let sent = 0, skipped = 0, failed = 0;
  const results: any[] = [];

  for (const row of rows ?? []) {
    // Re-check suppression at send time
    const [supA, supB, blk, unsub] = await Promise.all([
      sb.from("email_suppression_unified").select("email").ilike("email", row.email).maybeSingle(),
      sb.from("suppressed_emails").select("email").ilike("email", row.email).maybeSingle(),
      sb.from("outreach_blocklist").select("email").ilike("email", row.email).maybeSingle(),
      sb.from("email_unsubscribe_tokens").select("email,used_at").ilike("email", row.email).not("used_at", "is", null).maybeSingle(),
    ]);
    if (supA.data || supB.data || blk.data || unsub.data) {
      await sb.from("trial_resend_queue").update({ status: "skipped", skip_reason: "suppressed_at_send_time", send_attempted_at: new Date().toISOString() }).eq("id", row.id);
      skipped++;
      continue;
    }

    if (dryRun) {
      results.push({ id: row.id, email: row.email, product: row.product_key, would_send: true });
      continue;
    }

    const html = buildHtml(row as any);
    const subject = `Your ${PRODUCT_COPY[row.product_key]?.label ?? "DWA"} trial is ready (no card)`;
    const res = await dwaEmail({ to: row.email, subject, html });

    if (res.ok) {
      await sb.from("trial_resend_queue").update({ status: "sent", send_attempted_at: new Date().toISOString(), send_completed_at: new Date().toISOString(), resend_id: res.resendId ?? null }).eq("id", row.id);
      sent++;
    } else {
      await sb.from("trial_resend_queue").update({ status: "failed", send_attempted_at: new Date().toISOString(), error_message: res.error ?? "unknown" }).eq("id", row.id);
      failed++;
    }
    // small smoothing delay
    await new Promise((r) => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({ ok: true, dry_run: dryRun, processed: rows?.length ?? 0, sent, skipped, failed, sample: results.slice(0, 5) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
