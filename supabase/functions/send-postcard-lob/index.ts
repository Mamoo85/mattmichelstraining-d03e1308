/**
 * send-postcard-lob — Sends physical postcards via Lob API
 * Pulls approved campaigns from postcard_campaigns + prospects from postcard_prospects
 * Uses LOB_API_KEY secret. 5 free TechAlert candidate alerts offer.
 * Can be triggered by cron (monthly 1st) or manually from admin.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

// ── COST GUARDRAILS (Matt: change here to adjust caps) ─────────────────
const MAX_PER_RUN = 500;
const MAX_PER_MONTH = 2000;
const COST_PER_POSTCARD = 0.85;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "DWA Postcard Engine <matt@detroitwebagent.com>", to: ["matt@detroitwebagent.com"], subject, html }),
  }).catch(() => {});
}

async function getMonthSentCount(sb: any): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("postcard_send_log")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", monthStart.toISOString());
  return count || 0;
}

const RETURN_ADDRESS = {
  name: "Detroit Web Agent",
  address_line1: "PO Box 36283",
  address_city: "Grosse Pointe",
  address_state: "MI",
  address_zip: "48236",
};

function buildFrontHtml(copyFront: string): string {
  return `
    <div style="width:6in;height:4in;display:flex;align-items:center;justify-content:center;background:#0a1628;color:white;font-family:Arial,sans-serif;padding:0.5in;">
      <div style="text-align:center;">
        <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;margin-bottom:16px;">DETROIT WEB AGENT</div>
        <div style="font-size:22px;font-weight:bold;line-height:1.3;">${copyFront}</div>
        <div style="margin-top:20px;padding:8px 24px;background:#00d4ff;color:#0a1628;font-weight:bold;font-size:14px;display:inline-block;border-radius:4px;">5 FREE CANDIDATE ALERTS</div>
      </div>
    </div>`;
}

function buildBackHtml(copyBack: string, qrDataUri: string): string {
  return `
    <div style="width:6in;height:4in;font-family:Arial,sans-serif;padding:0.4in;display:flex;gap:0.3in;">
      <div style="flex:1;">
        <div style="font-size:13px;line-height:1.5;color:#333;">${copyBack}</div>
        <div style="margin-top:16px;font-size:11px;color:#666;">
          <strong>Detroit Web Agent</strong><br/>
          matt@detroitwebagent.com<br/>
          (313) 992-1219
        </div>
      </div>
      <div style="width:1.4in;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <img src="${qrDataUri}" style="width:1.2in;height:1.2in;" />
        <div style="font-size:9px;color:#666;margin-top:6px;text-align:center;">Scan for 5 FREE alerts</div>
      </div>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const maxSend = Math.min(body.max || 50, MAX_PER_RUN);
    const county = body.county || "Macomb";
    const dryRun = body.dry_run === true;

    // Get approved campaign copy
    const { data: campaigns } = await sb
      .from("postcard_campaigns")
      .select("*")
      .eq("status", "approved")
      .eq("county", county)
      .order("created_at", { ascending: false })
      .limit(1);

    const campaign = campaigns?.[0];
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: "No approved campaign for county: " + county }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get prospects not yet sent
    const { data: prospects } = await (sb as any)
      .from("postcard_prospects")
      .select("*")
      .eq("county", county)
      .is("sent_at", null)
      .limit(maxSend);

    if (!prospects?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "No unsent prospects for " + county }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── COST GUARDRAILS ─────────────────────────────────────────────
    if (!dryRun) {
      if (prospects.length > MAX_PER_RUN) {
        const msg = `🚨 Postcard run BLOCKED: ${prospects.length} > ${MAX_PER_RUN}/run cap`;
        await notifyMatt(msg, `<p>${msg}</p>`);
        return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const monthSent = await getMonthSentCount(sb);
      if (monthSent + prospects.length > MAX_PER_MONTH) {
        const msg = `🚨 Postcard run BLOCKED: monthly cap. ${monthSent} + ${prospects.length} > ${MAX_PER_MONTH}/month`;
        await notifyMatt(msg, `<p>${msg}</p>`);
        return new Response(JSON.stringify({ error: msg, sent_this_month: monthSent, cap: MAX_PER_MONTH }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`[send-postcard-lob] Cost OK. ${prospects.length} × $${COST_PER_POSTCARD} = $${(prospects.length * COST_PER_POSTCARD).toFixed(2)}. Month: ${monthSent}/${MAX_PER_MONTH}`);
    }

    const frontHtml = buildFrontHtml(campaign.copy_front);
    // Self-hosted QR — no external dependency at mail time
    const qrDataUri = await qrcode(campaign.qr_url, { size: 260 }) as string;
    const backHtml = buildBackHtml(campaign.copy_back, qrDataUri);

    let sent = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      if (!prospect.address_line1 || !prospect.city || !prospect.state || !prospect.zip) {
        errors.push(`Skipped ${prospect.business_name}: missing address`);
        continue;
      }

      if (dryRun) {
        sent++;
        continue;
      }

      try {
        const lobRes = await fetch("https://api.lob.com/v1/postcards", {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(LOB_API_KEY + ":"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: `TechAlert - ${prospect.business_name} - ${county}`,
            to: {
              name: prospect.business_name,
              address_line1: prospect.address_line1,
              address_line2: prospect.address_line2 || undefined,
              address_city: prospect.city,
              address_state: prospect.state,
              address_zip: prospect.zip,
            },
            from: RETURN_ADDRESS,
            front: frontHtml,
            back: backHtml,
            size: "4x6",
          }),
        });

        if (lobRes.ok) {
          const lobData = await lobRes.json();

          // Log the send
          await sb.from("postcard_send_log").insert({
            prospect_id: prospect.id,
            campaign_id: campaign.id,
            lob_id: lobData.id,
            address_line1: prospect.address_line1,
            city: prospect.city,
            state: prospect.state,
            zip: prospect.zip,
            business_name: prospect.business_name,
            status: "sent",
            delivery_status: lobData.expected_delivery_date || "processing",
          });

          // Mark prospect as sent
          await (sb as any)
            .from("postcard_prospects")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", prospect.id);

          sent++;
        } else {
          const errText = await lobRes.text();
          errors.push(`Lob error for ${prospect.business_name}: ${errText.slice(0, 200)}`);
        }
      } catch (e) {
        errors.push(`Error sending to ${prospect.business_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.log(`[send-postcard-lob] Sent ${sent}/${prospects.length} postcards for ${county}. Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ ok: true, sent, total: prospects.length, errors: errors.slice(0, 10) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-postcard-lob] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
