/**
 * send-fax
 * Sends a Twilio Programmable Fax to one prospect about one lead.
 * JFPA compliant: opt-out notice hardcoded on every fax — not editable.
 * Checks fax_opt_outs table and prospect.opt_out_fax before sending.
 *
 * POST { prospect_id, lead_id, campaign_id? }
 * Returns { ok, fax_sid, cost_cents }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const DWA_PHONE = "+13139921219";
const FAX_COST_CENTS = 7; // ~$0.07/page via Twilio

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIG_LABELS: Record<string, string> = {
  lis_pendens: "Pre-Foreclosure / Lis Pendens Filing",
  high_equity_renovation: "High-Equity Renovation (BSEED Permit ≥$100k)",
  new_llc: "New LLC / Business Formation",
  foreclosure_notice: "Foreclosure Notice",
  fsbo: "For Sale By Owner",
  divorce_filing: "Divorce Filing",
};

function buildFaxHtml(prospect: any, lead: any): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const sigLabel = SIG_LABELS[lead.signal_type] || lead.signal_type?.replace(/_/g, " ") || "Mortgage Lead";
  const city = lead.city || "Metro Detroit";
  const score = lead.score ?? "–";
  const estLoan = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount / 1000)}k`
    : "N/A";
  const commission = lead.estimated_loan_amount
    ? `$${Math.round(lead.estimated_loan_amount * 0.01).toLocaleString()}`
    : "est. $2,000+";
  const toName = [prospect.full_name, prospect.company_name].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; font-size: 13px; padding: 28px 32px; }
  .hdr { border-bottom: 3px solid #00d4ff; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { font-size: 20px; font-weight: 900; letter-spacing: 1.5px; }
  .brand em { color: #00d4ff; font-style: normal; }
  .meta { font-size: 11px; color: #555; margin-top: 5px; line-height: 1.7; }
  .hero { background: #0a1628; color: #fff; border-radius: 5px; padding: 16px 20px; margin: 16px 0; }
  .hero-title { font-size: 15px; font-weight: bold; color: #00d4ff; margin-bottom: 8px; }
  .hero-body { font-size: 12.5px; line-height: 1.65; }
  .grid { display: grid; grid-template-columns: 160px 1fr; gap: 6px 10px; margin: 14px 0 16px; }
  .lbl { font-weight: bold; font-size: 12px; color: #374151; }
  .val { font-size: 12px; }
  .opener { background: #f0fdf4; border-left: 3px solid #22c55e; padding: 10px 14px; margin: 14px 0; font-size: 12px; line-height: 1.6; color: #166534; }
  .cta { background: #0a1628; color: #00d4ff; text-align: center; padding: 12px; border-radius: 4px; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; margin: 16px 0; }
  .contact { font-size: 12px; margin-bottom: 6px; }
  .footer { border-top: 1px solid #d1d5db; margin-top: 20px; padding-top: 12px; font-size: 10px; color: #6b7280; line-height: 1.6; }
  .optout { background: #fffbeb; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 3px; margin-top: 8px; font-size: 10px; }
  .optout strong { color: #92400e; }
</style>
</head>
<body>
<div class="hdr">
  <div class="brand">DETROIT <em>WEB AGENCY</em></div>
  <div class="meta">
    <strong>Date:</strong> ${today} &nbsp;|&nbsp;
    <strong>From:</strong> Detroit Web Agency &nbsp;|&nbsp;
    <strong>Phone:</strong> (313) 992-1219 &nbsp;|&nbsp;
    <strong>Pages:</strong> 1<br/>
    <strong>To:</strong> ${toName || "Licensed Loan Officer, Michigan"}
  </div>
</div>

<div class="hero">
  <div class="hero-title">Exclusive Mortgage Lead — ${city}, MI</div>
  <div class="hero-body">
    Detroit Web Agency monitors BSEED permits, Wayne County court filings, and public records
    24/7 across Metro Detroit to surface high-intent homeowner signals <em>before</em> they
    hit the public market. We flagged one in your territory.
  </div>
</div>

<div class="grid">
  <span class="lbl">Signal Type</span>   <span class="val">${sigLabel}</span>
  <span class="lbl">Location</span>      <span class="val">${city}, MI${lead.zip ? ` · ZIP ${lead.zip}` : ""}</span>
  <span class="lbl">Lead Score</span>    <span class="val">${score}/10</span>
  <span class="lbl">Est. Loan</span>     <span class="val">${estLoan}</span>
  <span class="lbl">Est. Commission</span> <span class="val">${commission} @ 1%</span>
  <span class="lbl">Signal Date</span>   <span class="val">${lead.signal_date || "Recent"}</span>
</div>

${lead.suggested_opener ? `<div class="opener"><strong>Suggested opener:</strong><br/>"${lead.suggested_opener.slice(0, 200)}${lead.suggested_opener.length > 200 ? "…" : ""}"</div>` : ""}

<p style="font-size:12.5px;line-height:1.6;margin:12px 0;">
  Only <strong>one loan officer</strong> gets exclusive access to this lead's full contact info.
  Claim it before it posts to our public marketplace.
</p>

<div class="cta">Claim This Lead → detroitwebagent.com/mortgage-radar</div>

<div class="contact">Questions? Call or text Matt directly: <strong>(313) 992-1219</strong></div>
<div class="contact">Email: <strong>matt@detroitwebagent.com</strong></div>

<div class="footer">
  Detroit Web Agency &nbsp;|&nbsp; Detroit, MI &nbsp;|&nbsp; (313) 992-1219 &nbsp;|&nbsp; detroitwebagent.com
  <div class="optout">
    <strong>JFPA OPT-OUT NOTICE (Required by Law):</strong> To stop receiving faxes from Detroit Web Agency,
    call <strong>(313) 992-1219</strong> or email <strong>matt@detroitwebagent.com</strong> with the subject
    "FAX OPT-OUT". Your number will be removed within 30 days and will not receive future faxes.
    Sender: Detroit Web Agency, Detroit, MI. Date of transmission: ${today}.
  </div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
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
    if (!prospect.fax_number) return new Response(JSON.stringify({ ok: false, error: "no fax number on prospect" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (prospect.opt_out_fax) return new Response(JSON.stringify({ ok: false, error: "prospect opted out of fax" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check fax_opt_outs table
    const { data: globalOptOut } = await (sb.from as any)("fax_opt_outs")
      .select("id").eq("fax_number", prospect.fax_number).maybeSingle();
    if (globalOptOut) {
      await (sb.from as any)("marketplace_prospects")
        .update({ opt_out_fax: true, updated_at: new Date().toISOString() }).eq("id", prospect_id);
      return new Response(JSON.stringify({ ok: false, error: "fax number in global opt-out list" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "Twilio credentials not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Store fax HTML in Supabase Storage so Twilio can fetch it via public URL
    const htmlContent = buildFaxHtml(prospect, lead);
    const storageKey = `fax-temp/fax-${prospect_id.slice(0, 8)}-${lead_id.slice(0, 8)}-${Date.now()}.html`;

    const { error: uploadErr } = await sb.storage
      .from("lead-dossier-pdfs")
      .upload(storageKey, new TextEncoder().encode(htmlContent), {
        contentType: "text/html",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: urlData } = sb.storage
      .from("lead-dossier-pdfs")
      .getPublicUrl(storageKey);
    const mediaUrl = urlData?.publicUrl;
    if (!mediaUrl) throw new Error("Failed to get public URL for fax content");

    // Send via Twilio Programmable Fax
    const faxParams = new URLSearchParams({
      From: DWA_PHONE,
      To: prospect.fax_number,
      MediaUrl: mediaUrl,
      Quality: "fine",
    });

    const faxRes = await fetch("https://fax.twilio.com/v1/Faxes", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: faxParams.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const faxData = await faxRes.json();
    if (!faxRes.ok) throw new Error(`Twilio fax error: ${faxData?.message ?? faxRes.status}`);

    const faxSid: string = faxData.sid;

    // Record the send
    await (sb.from as any)("lo_outreach_sends").insert({
      campaign_id: campaign_id ?? null,
      prospect_id,
      channel: "fax",
      external_id: faxSid,
      cost_cents: FAX_COST_CENTS,
    });

    // Update prospect last_outreach
    await (sb.from as any)("marketplace_prospects").update({
      last_outreach_at: new Date().toISOString(),
      last_outreach_channel: "fax",
      updated_at: new Date().toISOString(),
    }).eq("id", prospect_id);

    return new Response(
      JSON.stringify({ ok: true, fax_sid: faxSid, cost_cents: FAX_COST_CENTS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
