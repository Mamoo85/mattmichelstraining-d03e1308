/**
 * send-postcard
 * Sends a 4×6 postcard via Lob.com API to one prospect about one lead.
 * No regulations for B2B direct mail — no opt-out mechanism required.
 * Requires LOB_API_KEY in Lovable secrets.
 *
 * POST { prospect_id, lead_id, campaign_id? }
 * Returns { ok, lob_id, cost_cents }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIG_LABELS: Record<string, string> = {
  lis_pendens: "Pre-Foreclosure Signal",
  high_equity_renovation: "High-Equity Renovation",
  new_llc: "New Business Formation",
  foreclosure_notice: "Foreclosure Filing",
  fsbo: "FSBO Listing",
  divorce_filing: "Divorce Filing",
};

// Postcard front: dark DWA brand, bold headline, teaser
function buildFront(lead: any): string {
  const city = lead.city || "Metro Detroit";
  const sigLabel = SIG_LABELS[lead.signal_type] || "High-Intent Signal";
  const estLoan = lead.estimated_loan_amount
    ? ` · ~$${Math.round(lead.estimated_loan_amount / 1000)}k loan`
    : "";

  return `<html><head><meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{width:6.25in;height:4.25in;background:#0a1628;font-family:'Inter',Arial,sans-serif;
       color:white;display:flex;flex-direction:column;justify-content:center;padding:0.45in 0.5in;
       position:relative;overflow:hidden;}
  .glow{position:absolute;top:-80px;right:-80px;width:320px;height:320px;
        background:radial-gradient(circle,#00d4ff22 0%,transparent 70%);border-radius:50%;}
  .badge{font-size:8pt;background:#00d4ff1a;border:1px solid #00d4ff55;color:#00d4ff;
         padding:3px 10px;border-radius:20px;display:inline-block;margin-bottom:14px;
         letter-spacing:0.8px;text-transform:uppercase;}
  h1{font-size:26pt;font-weight:900;line-height:1.1;margin-bottom:10px;}
  h1 em{color:#00d4ff;font-style:normal;}
  .sub{font-size:11pt;color:#94a3b8;margin-bottom:18px;line-height:1.5;}
  .url{font-size:11pt;font-weight:700;color:#00d4ff;letter-spacing:0.5px;}
  .brand{position:absolute;bottom:0.35in;right:0.45in;font-size:7.5pt;
         color:#475569;letter-spacing:1.5px;text-transform:uppercase;}
</style></head>
<body>
  <div class="glow"></div>
  <div class="badge">${sigLabel} — ${city}, MI${estLoan}</div>
  <h1>A hot lead just<br/>surfaced in <em>your</em><br/>territory.</h1>
  <div class="sub">Exclusive access — before it hits<br/>the public marketplace.</div>
  <div class="url">detroitwebagent.com/mortgage-radar</div>
  <div class="brand">Detroit Web Agency</div>
</body></html>`;
}

// Postcard back: white, readable, personal pitch + 3 bullets + CTA
function buildBack(prospect: any, lead: any): string {
  const city = lead.city || "Metro Detroit";
  const score = lead.score ?? "–";
  const estLoan = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount / 1000)}k`
    : "six figures";
  const commission = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount * 0.01).toLocaleString()}`
    : "~$2,000+";
  const firstName = prospect.full_name?.split(" ")[0] || "there";
  const sigLabel = SIG_LABELS[lead.signal_type] || lead.signal_type?.replace(/_/g, " ") || "mortgage signal";

  return `<html><head><meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{width:6.25in;height:4.25in;background:white;font-family:'Inter',Arial,sans-serif;
       color:#1a1a2e;padding:0.42in 0.5in;position:relative;}
  .greeting{font-size:12pt;font-weight:600;margin-bottom:10px;}
  .intro{font-size:9.5pt;color:#374151;line-height:1.6;margin-bottom:12px;}
  ul{list-style:none;margin-bottom:14px;}
  li{font-size:9pt;color:#374151;padding:2.5px 0;}
  li::before{content:"✓ ";color:#00d4ff;font-weight:bold;}
  .cta-box{background:#0a1628;color:white;padding:9px 16px;border-radius:4px;
            font-size:9.5pt;font-weight:700;display:inline-block;margin-bottom:8px;}
  .cta-box span{color:#00d4ff;}
  .contact{font-size:8.5pt;color:#6b7280;}
  .addr-block{position:absolute;bottom:0.35in;right:0.45in;font-size:8pt;
               text-align:right;line-height:1.7;color:#374151;}
</style></head>
<body>
  <div class="greeting">Hi ${firstName},</div>
  <p class="intro">
    Detroit Web Agency monitors BSEED permits, Wayne County court filings,
    and public records 24/7 across Metro Detroit to surface mortgage opportunities
    before they hit Zillow or public databases.
  </p>
  <ul>
    <li>${sigLabel} in <strong>${city}</strong> — verified signal</li>
    <li>Lead score: <strong>${score}/10</strong> · Est. loan: <strong>${estLoan}</strong></li>
    <li>Exclusive — one LO gets full contact info</li>
    <li>Your est. commission @ 1%: <strong>${commission}</strong></li>
  </ul>
  <div class="cta-box">Claim at <span>detroitwebagent.com/mortgage-radar</span></div>
  <div class="contact">Questions? Text Matt: (313) 992-1219 · matt@detroitwebagent.com</div>
  <div class="addr-block">
    Detroit Web Agency<br/>
    Detroit, MI<br/>
    (313) 992-1219
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!LOB_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "LOB_API_KEY not set — add to Lovable secrets (free account: lob.com)" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { prospect_id, lead_id, campaign_id } = await req.json();
    if (!prospect_id || !lead_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "prospect_id and lead_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: prospect }, { data: lead }] = await Promise.all([
      (sb.from as any)("marketplace_prospects").select("*").eq("id", prospect_id).maybeSingle(),
      (sb.from as any)("mortgage_radar_leads").select("*").eq("id", lead_id).maybeSingle(),
    ]);

    if (!prospect) return new Response(JSON.stringify({ ok: false, error: "prospect not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!lead) return new Response(JSON.stringify({ ok: false, error: "lead not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const addr = prospect.mailing_address;
    if (!addr?.street || !addr?.city || !addr?.zip) {
      return new Response(
        JSON.stringify({ ok: false, error: "prospect missing mailing address (need street, city, zip)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lobPayload = {
      description: `Lead outreach: ${lead.signal_type || "signal"} ${lead.city || ""}`.trim().slice(0, 255),
      to: {
        name: (prospect.full_name || prospect.company_name || "Loan Officer").slice(0, 50),
        address_line1: addr.street.slice(0, 64),
        address_city: addr.city.slice(0, 200),
        address_state: (addr.state || "MI").slice(0, 2),
        address_zip: String(addr.zip).slice(0, 10),
        address_country: "US",
      },
      from: {
        name: "Detroit Web Agency",
        address_line1: "1000 Woodward Ave",
        address_city: "Detroit",
        address_state: "MI",
        address_zip: "48226",
        address_country: "US",
      },
      front: buildFront(lead),
      back: buildBack(prospect, lead),
      size: "4x6",
      mail_type: "usps_first_class",
    };

    const lobRes = await fetch("https://api.lob.com/v1/postcards", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${LOB_API_KEY}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lobPayload),
      signal: AbortSignal.timeout(20000),
    });

    const lobData = await lobRes.json();
    if (!lobRes.ok) {
      throw new Error(`Lob error: ${lobData?.error?.message ?? JSON.stringify(lobData?.error) ?? lobRes.status}`);
    }

    const lobId: string = lobData.id;
    const costCents = Math.round((parseFloat(lobData.price) || 0.82) * 100);

    // Record in our tracking table
    await (sb.from as any)("lo_outreach_sends").insert({
      campaign_id: campaign_id ?? null,
      prospect_id,
      channel: "postcard",
      external_id: lobId,
      cost_cents: costCents,
    });

    // Update prospect last_outreach
    await (sb.from as any)("marketplace_prospects").update({
      last_outreach_at: new Date().toISOString(),
      last_outreach_channel: "postcard",
      updated_at: new Date().toISOString(),
    }).eq("id", prospect_id);

    return new Response(
      JSON.stringify({ ok: true, lob_id: lobId, cost_cents: costCents }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
