/**
 * send-postcards
 * Sends physical postcards via Lob API to postcard_prospects.
 * Accepts a campaign_id, looks up the copy + prospects, sends via Lob.
 * All stats on postcards are 100% real data from Michigan LARA public records.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lob requires HTML for postcard front and back
function buildPostcardFrontHTML(headline: string): string {
  return `
<html><head><meta charset="UTF-8"><style>
  body { margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; background:#0a1628; color:#fff; }
  .container { width:6in; height:4in; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:0.5in; box-sizing:border-box; }
  h1 { font-size:28px; line-height:1.3; text-align:center; margin:0; color:#00d4ff; }
  .badge { margin-top:16px; background:#00d4ff; color:#0a1628; padding:4px 12px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:1px; }
</style></head>
<body><div class="container">
  <h1>${headline}</h1>
  <div class="badge">100% REAL DATA · MICHIGAN LARA PUBLIC RECORDS</div>
</div></body></html>`;
}

function buildPostcardBackHTML(bodyText: string, qrUrl: string): string {
  return `
<html><head><meta charset="UTF-8"><style>
  body { margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#1a1a1a; }
  .container { width:6in; height:4in; display:flex; padding:0.4in; box-sizing:border-box; gap:0.3in; }
  .left { flex:1; font-size:13px; line-height:1.5; }
  .right { width:1.8in; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .right img { width:1.5in; height:1.5in; }
  .cta { font-size:11px; color:#0a1628; font-weight:700; margin-top:8px; text-align:center; }
  .logo { font-size:14px; font-weight:700; color:#0a1628; margin-bottom:8px; }
  .disclaimer { font-size:8px; color:#999; margin-top:auto; }
</style></head>
<body><div class="container">
  <div class="left">
    <div class="logo">TechAlert by Detroit Web Agent</div>
    <p>${bodyText}</p>
    <p class="disclaimer">All statistics are verified from Michigan LARA/MIOSHA public records. detroitwebagent.com</p>
  </div>
  <div class="right">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}" alt="QR Code" />
    <div class="cta">SCAN TO SEE<br/>THE LIVE FEED</div>
  </div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOB_API_KEY) {
      return new Response(JSON.stringify({ error: "LOB_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign
    const { data: campaign, error: campErr } = await sb
      .from("postcard_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unsent prospects in the campaign's county with valid addresses
    const { data: prospects } = await sb
      .from("postcard_prospects")
      .select("*")
      .ilike("county", campaign.county)
      .is("postcard_sent_at", null)
      .not("address_line1", "is", null)
      .not("city", "is", null)
      .not("zip", "is", null)
      .limit(100);

    if (!prospects || prospects.length === 0) {
      return new Response(JSON.stringify({ error: "No unsent prospects with valid addresses found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const frontHTML = buildPostcardFrontHTML(campaign.copy_front);
    const backHTML = buildPostcardBackHTML(campaign.copy_back, campaign.qr_url);

    let sentCount = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      try {
        const lobRes = await fetch("https://api.lob.com/v1/postcards", {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(LOB_API_KEY + ":")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: `TechAlert Postcard - ${prospect.business_name}`,
            to: {
              name: prospect.owner_name || prospect.business_name,
              address_line1: prospect.address_line1,
              address_line2: prospect.address_line2 || undefined,
              address_city: prospect.city,
              address_state: prospect.state || "MI",
              address_zip: prospect.zip,
            },
            from: {
              name: "Detroit Web Agent",
              address_line1: "PO Box 36386",
              address_city: "Grosse Pointe",
              address_state: "MI",
              address_zip: "48236",
            },
            front: frontHTML,
            back: backHTML,
            size: "4x6",
          }),
        });

        if (lobRes.ok) {
          sentCount++;
          await sb
            .from("postcard_prospects")
            .update({ postcard_sent_at: new Date().toISOString(), postcard_batch_id: campaign_id })
            .eq("id", prospect.id);
        } else {
          const errBody = await lobRes.text();
          errors.push(`${prospect.business_name}: ${errBody}`);
        }
      } catch (lobErr) {
        errors.push(`${prospect.business_name}: ${lobErr instanceof Error ? lobErr.message : String(lobErr)}`);
      }
    }

    // Update campaign counts
    await sb
      .from("postcard_campaigns")
      .update({
        prospect_count: prospects.length,
        sent_count: (campaign.sent_count || 0) + sentCount,
        status: "mailed",
        lob_batch_id: campaign_id,
      })
      .eq("id", campaign_id);

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "DWA Postcard Engine <matt@detroitwebagent.com>",
          to: ["matthewmichels@gmail.com"],
          subject: `📬 ${sentCount} postcards sent to ${campaign.county} County`,
          html: `
            <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px;">
              <h1 style="color:#00d4ff;font-size:24px;">📬 Postcards Sent!</h1>
              <p><strong>${sentCount}</strong> of ${prospects.length} postcards mailed to ${campaign.county} County businesses</p>
              <p style="color:#94a3b8;font-size:14px;">All postcards feature 100% real stats from Michigan LARA public records.</p>
              ${errors.length > 0 ? `<p style="color:#f87171;">${errors.length} errors — check logs</p>` : ""}
              <p style="color:#94a3b8;font-size:12px;margin-top:16px;">QR links to: ${campaign.qr_url}</p>
            </div>
          `,
        }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: prospects.length, errors: errors.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-postcards] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
