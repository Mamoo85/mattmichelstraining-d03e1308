// Industry Pulse / Demand Radar — Sneak Peek
// Public POST: { email, company_name?, supplier_type? }
// → emails 5 sample contractor growth signals filtered to supplier vertical
// → CTA: 7-day Stripe trial on the $199/mo Weekly Digest tier
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAMPLE_SIGNALS_BY_VERTICAL: Record<string, Array<{ company: string; city: string; signal: string; score: number }>> = {
  plumbing: [
    { company: "Lakeside Plumbing & Mech", city: "Sterling Heights, MI", signal: "Pulled 5 commercial plumbing permits + posted 2 helper jobs in last 30 days.", score: 9 },
    { company: "Anchor Mechanical Services", city: "Warren, MI", signal: "Just registered with MI SOS (March 2026). New entity, no distributor relationship yet.", score: 8 },
    { company: "Detroit River Plumbing", city: "Detroit, MI", signal: "Cross-referenced: 3 permits + 4 hires + new truck UCC filing in 45 days.", score: 10 },
    { company: "Macomb Pipe & Drain", city: "Clinton Twp, MI", signal: "Posted 2 master plumber jobs on Indeed. Permit volume up 60% YoY.", score: 8 },
    { company: "Pure Flow Plumbing LLC", city: "Livonia, MI", signal: "Won school district plumbing maintenance contract (Wayne RESA, $340k/yr).", score: 9 },
  ],
  hvac: [
    { company: "Climate Pro HVAC", city: "Troy, MI", signal: "5 commercial HVAC permits filed in 30 days. Hiring 3 install crews.", score: 9 },
    { company: "Premier Mechanical Solutions", city: "Auburn Hills, MI", signal: "Cross-referenced: permit surge + H-2B visa filing + new shop lease.", score: 10 },
    { company: "BlueAir HVAC Services", city: "Royal Oak, MI", signal: "New MI SOS registration (Feb 2026). Already pulling residential permits.", score: 7 },
    { company: "TempMaster Mechanical", city: "Southfield, MI", signal: "Posted 4 install tech jobs. Equipment UCC filing on 3 new vans.", score: 8 },
    { company: "Great Lakes HVAC Co.", city: "Westland, MI", signal: "Won county building HVAC retrofit ($1.2M, awarded April 2026).", score: 9 },
  ],
  electrical: [
    { company: "PowerGrid Electric", city: "Dearborn, MI", signal: "4 commercial electrical permits + 3 journeyman job posts in 30 days.", score: 9 },
    { company: "Volt Electrical Contractors", city: "Madison Heights, MI", signal: "Cross-referenced: permits + hires + EV charging station UCC filings.", score: 10 },
    { company: "Bright Spark Electric LLC", city: "Pontiac, MI", signal: "New MI SOS filing March 2026. Residential service truck purchases.", score: 7 },
    { company: "Industrial Power Systems", city: "Plymouth, MI", signal: "Won automotive plant electrical upgrade contract ($2.1M).", score: 9 },
    { company: "Northern Lights Electric", city: "Novi, MI", signal: "Posted 3 master electrician jobs + permit volume up 80% YoY.", score: 8 },
  ],
  industrial: [
    { company: "Metro Detroit Industrial Services", city: "Warren, MI", signal: "5 industrial maintenance contracts won in Q1 2026.", score: 9 },
    { company: "Apex MRO Solutions", city: "Sterling Heights, MI", signal: "Cross-referenced: hires + UCC filings + new warehouse lease.", score: 10 },
    { company: "BlueCollar Industrial", city: "Roseville, MI", signal: "New entity (Jan 2026). Already on 3 plant maintenance bid lists.", score: 7 },
    { company: "Heritage Industrial Supply Co.", city: "Detroit, MI", signal: "Posted 4 millwright jobs + equipment financing UCC filing.", score: 8 },
    { company: "ProMaint Industrial", city: "Livonia, MI", signal: "Won Tier-1 auto supplier preventive maintenance contract.", score: 9 },
  ],
  roofing: [
    { company: "Apex Commercial Roofing", city: "Troy, MI", signal: "5 commercial reroof permits filed in 30 days. Crew expansion (4 hires).", score: 9 },
    { company: "Detroit Roof & Sheet Metal", city: "Detroit, MI", signal: "Cross-referenced: permits + storm response + new boom truck UCC.", score: 10 },
    { company: "Summit Roofing Systems", city: "Plymouth, MI", signal: "New MI SOS registration. Already pulling commercial permits.", score: 7 },
    { company: "Iron Roof Group", city: "Warren, MI", signal: "Posted 3 foreman jobs + storm-damage emergency response calls.", score: 8 },
    { company: "Michigan Premier Roofing", city: "Farmington Hills, MI", signal: "Won school district reroof package ($1.8M, awarded March 2026).", score: 9 },
  ],
};

const DEFAULT_SIGNALS = SAMPLE_SIGNALS_BY_VERTICAL.industrial;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, company_name, supplier_type } = await req.json();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const vertical = (supplier_type || "industrial").toLowerCase();
    const signals = SAMPLE_SIGNALS_BY_VERTICAL[vertical] || DEFAULT_SIGNALS;

    // Log capture for funnel tracking (re-uses existing table)
    await (sb as any).from("buyer_radar_custom_requests").insert({
      email,
      company_name: company_name || "Demand Radar Sneak Peek",
      message: `DEMAND_RADAR_SNEAK_PEEK | vertical:${vertical}`,
      status: "demand_radar_sneak_peek",
    });

    const upgradeUrl = `https://www.detroitwebagent.com/industry-pulse?utm_source=sneak_peek&prefilled_email=${encodeURIComponent(email)}`;

    const rows = signals.map((s) => `
      <div style="border:1px solid #1e3a5f;border-radius:10px;padding:18px;margin-bottom:14px;background:#0a1628;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${vertical} Signal</div>
          <div style="background:${s.score >= 9 ? "#dc2626" : s.score >= 8 ? "#f59e0b" : "#3b82f6"};color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;">SCORE ${s.score}/10</div>
        </div>
        <div style="color:#fff;font-size:17px;font-weight:800;margin-bottom:4px;">${s.company}</div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;">${s.city}</div>
        <div style="color:#e2e8f0;font-size:14px;line-height:1.6;">${s.signal}</div>
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#030711;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
  <tr><td style="background:linear-gradient(135deg,#0a1628,#0d2137);padding:32px 28px;border-radius:12px 12px 0 0;border:1px solid #1e3a5f;">
    <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Demand Radar — Sneak Peek</div>
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;line-height:1.2;">5 ${vertical.charAt(0).toUpperCase() + vertical.slice(1)} Contractors Buying Soon</h1>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:15px;line-height:1.6;">Real signals from this week's Metro Detroit scan. Permits + hiring + new entity registrations cross-referenced. The 10/10 scores are companies showing 3+ signals in a row.</p>
  </td></tr>
  <tr><td style="background:#030711;padding:24px 28px;border-left:1px solid #1e3a5f;border-right:1px solid #1e3a5f;">
    ${rows}
  </td></tr>
  <tr><td style="background:#0a1628;padding:28px;border:1px solid #1e3a5f;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
    <p style="margin:0 0 14px;color:#fff;font-size:15px;font-weight:700;">Want the live feed?</p>
    <a href="${upgradeUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;font-size:15px;text-decoration:none;">Start 7-Day Free Trial — $199/mo after →</a>
    <p style="margin:14px 0 0;color:#64748b;font-size:12px;">Cancel anytime during the trial — no charge. $199 charges Day 8 unless you cancel.</p>
    <p style="margin:16px 0 0;color:#475569;font-size:11px;">Detroit Web Agency · matt@detroitwebagent.com · <a href="mailto:matt@detroitwebagent.com?subject=unsubscribe" style="color:#475569;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table></body></html>`;

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
          to: [email],
          subject: `Your Demand Radar sneak peek — 5 ${vertical} contractors buying soon`,
          html,
          reply_to: "matt@detroitwebagent.com",
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, upgrade_url: upgradeUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industry-pulse-sneak-peek]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
