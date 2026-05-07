// Trial reactivation single-send. Manually invoked by /dwa-admin/trial-reactivation.
// Per-recipient: checks suppression list, 7-day frequency cap, then sends one email.
// Never bulk-loops over a list — each invocation = one recipient = one trigger.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isBlocked } from "../_shared/outreach-blocklist.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERTICAL_LABELS: Record<string, string> = {
  roofing: "Roofing Radar",
  hvac: "HVAC Radar",
  plumbing: "Plumbing Radar",
  electrical: "Electrical Radar",
  pest_control: "Pest Control Radar",
  gutters: "Gutters Radar",
  exterior: "Exterior Radar",
  tree: "Tree Service Radar",
  restoration: "Restoration Radar",
  demo_junk: "Demo & Junk Radar",
  foundation: "Foundation Radar",
};

function buildHtml(opts: { businessName: string; trade: string; city: string; state: string; trialUrl: string }) {
  const verticalLabel = VERTICAL_LABELS[opts.trade] ?? "Trade Radar";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#0a1628 0%,#0d1d33 100%);padding:32px 28px;text-align:center;">
    <div style="display:inline-block;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;margin-bottom:16px;">FREE TRIAL — NO CREDIT CARD</div>
    <h1 style="color:#ffffff;font-size:26px;font-weight:900;margin:0 0 10px;line-height:1.2;">${verticalLabel}: Your Free Dashboard Is Ready</h1>
    <p style="color:#94a3b8;font-size:15px;margin:0;">${opts.city ? `Local ${opts.city} leads ` : "Local leads "}— claim before competitors do.</p>
  </div>
  <div style="padding:28px;">
    <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 16px;">Hey${opts.businessName ? ` ${opts.businessName}` : ""},</p>
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">I emailed you a couple weeks ago about Detroit Web Agency's lead radar. <strong>I built you a free trial dashboard.</strong> It already has real, scored leads in your service area — owner names, addresses, suggested call openers.</p>
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;"><strong>Nothing to install. No credit card. No catch.</strong></p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${opts.trialUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-size:16px;font-weight:800;text-decoration:none;padding:16px 32px;border-radius:10px;">Open My Free Dashboard →</a>
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">Reply to this email or text me directly: <a href="tel:+13139921219" style="color:#0891b2;font-weight:700;">(313) 992-1219</a></p>
    <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;">— Matt at Detroit Web Agency</p>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const businessName = String(body.business_name ?? "");
    const trade = String(body.trade ?? "hvac");
    const city = String(body.city ?? "");
    const state = String(body.state ?? "MI");
    const subject = String(body.subject ?? "Your free trial dashboard is ready");
    const trialUrl = String(body.trial_url ?? `https://detroitwebagent.com/start-trial?product=${trade}_radar`);

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Suppression / blocklist
    const blocked = await isBlocked(sb, email);
    if (blocked) {
      return new Response(JSON.stringify({ error: "blocked", reason: blocked }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. 7-day frequency cap on trial_reactivation_sends
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: recent } = await sb
      .from("trial_reactivation_sends")
      .select("id")
      .eq("email", email)
      .gte("sent_at", sevenDaysAgo)
      .limit(1);
    if (recent && recent.length > 0) {
      return new Response(JSON.stringify({ error: "frequency_cap", reason: "already sent in last 7 days" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Send via Resend
    const html = buildHtml({ businessName, trade, city, state, trialUrl });
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Matt at Detroit Web Agency <matt@detroitwebagent.com>",
        to: [email],
        reply_to: "matt@detroitwebagent.com",
        subject,
        html,
      }),
    });

    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok) {
      return new Response(JSON.stringify({ error: "resend_failed", detail: resendData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Log
    await sb.from("trial_reactivation_sends").insert({
      email,
      business_name: businessName,
      trade,
      city,
      state,
      subject,
      trial_url: trialUrl,
      resend_id: resendData?.id ?? null,
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, resend_id: resendData?.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
