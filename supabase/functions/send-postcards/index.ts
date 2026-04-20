/**
 * send-postcards
 * Sends physical postcards via Lob API to postcard_prospects.
 * Accepts a campaign_id, looks up the copy + prospects, sends via Lob.
 *
 * MANDATE: Never mention LARA, scraping, databases, or methods. Only "we invented a way."
 *
 * HONESTY UPDATE 2026-04-20:
 * - Logs EVERY Lob attempt (success + failure) to postcard_send_log
 * - Only marks campaign 'mailed' if sentCount > 0; 'failed' otherwise with last_error
 * - Supports dry_run flag for Diagnose button (no Lob calls, returns match analysis)
 * - Supports prospect_ids[] filter for "Resend Failed" button
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const MAX_PER_RUN = 500;
const MAX_PER_MONTH = 2000;
const COST_PER_POSTCARD = 0.85;
const COST_PER_POSTCARD_CENTS = 85;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const MATT_PHOTO = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg";
const DWA_BADGE = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "DWA Postcard Engine <matt@detroitwebagent.com>", to: [ADMIN_EMAIL], subject, html }),
  }).catch(() => {});
}

async function getMonthSentCount(sb: any): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("postcard_prospects")
    .select("id", { count: "exact", head: true })
    .gte("postcard_sent_at", monthStart.toISOString());
  return count || 0;
}

type AudienceType = "healthcare-agency" | "trades-agency" | "nursing-home" | "contractor" | "supply-house";

interface PostcardDesign {
  headline: string;
  subline: string;
  body: string;
  offer: string;
  qrPath: string;
  accentColor: string;
}

const DESIGNS: Record<AudienceType, PostcardDesign> = {
  "healthcare-agency": {
    headline: "We Find Licensed Nurses",
    subline: "Before Anyone Else",
    body: "We invented a way to identify newly licensed CNAs, LPNs, and RNs across Michigan — often within hours of certification. Your competitors don't have this. Your first 10 names are free. Verified. With contact info.",
    offer: "FREE 10 VERIFIED NURSE NAMES",
    qrPath: "/staffing?industry=healthcare&src=postcard",
    accentColor: "#10b981",
  },
  "trades-agency": {
    headline: "We Find Licensed Techs",
    subline: "Before Your Competitors",
    body: "We invented a proprietary system that identifies newly licensed HVAC techs, plumbers, electricians, and boiler operators across Michigan. Your first 10 names are free. Verified. With direct contact info.",
    offer: "FREE 10 LICENSED TECH NAMES",
    qrPath: "/staffing?industry=trades&src=postcard",
    accentColor: "#3b82f6",
  },
  "nursing-home": {
    headline: "Struggling to",
    subline: "Find Nurses?",
    body: "We invented a way to find newly licensed CNAs, LPNs, and RNs in your area — before they even start applying to jobs. Verified names with contact info, delivered daily. Your first 10 candidates are free. No strings.",
    offer: "FREE 10 NURSE CANDIDATES",
    qrPath: "/staffing?industry=healthcare&src=postcard-facility",
    accentColor: "#10b981",
  },
  "contractor": {
    headline: "Need Licensed Techs?",
    subline: "We Find Them First.",
    body: "We invented a way to identify newly licensed tradespeople in Michigan before they hit the job boards. Verified names, availability scores, direct contact info. Your first 10 names are free.",
    offer: "FREE 10 LICENSED NAMES",
    qrPath: "/go/techalert?src=postcard",
    accentColor: "#3b82f6",
  },
  "supply-house": {
    headline: "Know Who's Buying",
    subline: "Before They Call",
    body: "We invented a system that detects which companies are expanding — based on hiring patterns — and predicts what equipment they'll need next. You get the intel before your competitors. First month free.",
    offer: "FREE MONTH — DEMAND RADAR",
    qrPath: "/demand-radar?src=postcard",
    accentColor: "#06b6d4",
  },
};

async function buildFrontHTML(design: PostcardDesign, city: string, recipientName: string, campaignId: string, audienceType: AudienceType): Promise<string> {
  // ONE QR per postcard → multi-offer landing page (/postcard) for clean attribution.
  const qrUrl = `https://detroitwebagent.com/postcard?audience=${audienceType}&utm_campaign=${campaignId}&city=${city.toLowerCase().replace(/\s+/g, "-")}`;
  const c = design.accentColor;
  const qrDataUri = await qrcode(qrUrl, { size: 260 }) as string;

  // 3 secondary product mentions (everything except their hero offer).
  // Order: Talent Radar (other vertical), Demand Radar, FieldDesk, Missed Call Catch.
  const SECONDARY: Record<AudienceType, Array<{ icon: string; label: string }>> = {
    "healthcare-agency":  [{ icon: "🔧", label: "Talent Radar — Trades" }, { icon: "🛠️", label: "FieldDesk" },     { icon: "📞", label: "Missed Call Catch" }],
    "nursing-home":       [{ icon: "🔧", label: "Talent Radar — Trades" }, { icon: "🛠️", label: "FieldDesk" },     { icon: "📞", label: "Missed Call Catch" }],
    "trades-agency":      [{ icon: "🏥", label: "Talent Radar — Healthcare" }, { icon: "🛠️", label: "FieldDesk" }, { icon: "📞", label: "Missed Call Catch" }],
    "contractor":         [{ icon: "📡", label: "Demand Radar" },          { icon: "🛠️", label: "FieldDesk" },     { icon: "📞", label: "Missed Call Catch" }],
    "supply-house":       [{ icon: "🔧", label: "Talent Radar — Trades" }, { icon: "🛠️", label: "FieldDesk" },     { icon: "📞", label: "Missed Call Catch" }],
  };
  const secondary = SECONDARY[audienceType] || SECONDARY["contractor"];
  const secondaryHTML = secondary.map(s =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:7.5px;color:#8b949e;line-height:1.2;"><span style="font-size:9px;">${s.icon}</span><span>${s.label}</span></div>`
  ).join("");

  return `<html><head><meta charset="UTF-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif}
</style></head><body>
<div style="width:6.25in;height:4.25in;background:#0d1117;color:#e6edf3;display:flex;overflow:hidden;">
  <div style="flex:1;padding:0.5in 0.45in 0.4in;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      <div style="font-size:7px;color:#484f58;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:4px;">${city.toUpperCase()}</div>
      ${recipientName ? `<div style="font-size:8px;color:#484f58;margin-bottom:6px;">For: ${recipientName}</div>` : ""}
      <div style="font-size:22px;font-weight:900;line-height:1.15;letter-spacing:-0.5px;margin-bottom:10px;">${design.headline}<br><span style="color:${c};">${design.subline}</span></div>
      <div style="font-size:9.5px;color:#8b949e;line-height:1.55;margin-bottom:12px;">${design.body}</div>
      <div style="display:inline-block;background:${c}15;border:1.5px solid ${c}40;color:${c};font-size:9px;font-weight:800;padding:5px 12px;border-radius:4px;letter-spacing:0.5px;">${design.offer}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px 10px;">
      <img src="${MATT_PHOTO}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1.5px solid #30363d;" alt="Matt">
      <div style="font-size:8.5px;color:#8b949e;line-height:1.4;">
        <strong style="color:#e6edf3;font-size:9px;">Matt Michels</strong> — Founder<br>
        Don't believe it works? Text me.<br>
        I'll call you personally and prove it.<br>
        <span style="color:${c};font-weight:700;font-size:10px;">(313) 992-1219</span>
      </div>
    </div>
  </div>
  <div style="width:1.9in;background:#161b22;border-left:3px solid ${c};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.3in 0.18in;gap:8px;">
    <img src="${DWA_BADGE}" style="width:48px;height:48px;border-radius:50%;border:1.5px solid #30363d;" alt="DWA">
    <div style="font-size:8px;color:#8b949e;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Scan to claim</div>
    <img src="${qrDataUri}" width="118" height="118" style="border-radius:8px;border:2px solid #30363d;" alt="QR">
    <div style="font-size:9.5px;color:${c};font-weight:800;text-align:center;line-height:1.1;">${design.offer.includes("MONTH") ? "FREE MONTH" : "FREE 10 NAMES"}</div>
    <div style="width:100%;border-top:1px dashed #30363d;padding-top:6px;display:flex;flex-direction:column;gap:3px;">
      <div style="font-size:6.5px;color:#484f58;text-transform:uppercase;letter-spacing:0.8px;text-align:center;font-weight:700;margin-bottom:2px;">+ 3 More Free Tools</div>
      ${secondaryHTML}
    </div>
    <div style="font-size:6.5px;color:#484f58;text-align:center;">detroitwebagent.com</div>
  </div>
</div>
</body></html>`;
}

function buildBackHTML(city: string): string {
  return `<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif}
</style></head><body>
<div style="width:6.25in;height:4.25in;background:#fff;color:#1a1a1a;padding:0.5in;">
  <div style="height:100%;display:flex;flex-direction:column;justify-content:space-between;">
    <div>
      <div style="font-size:11px;font-weight:800;color:#0d1117;letter-spacing:1px;margin-bottom:4px;">DETROIT WEB AGENCY</div>
      <div style="font-size:9px;color:#666;">Grosse Pointe Park, MI &middot; We Handle The Tech</div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
      <div style="font-size:8px;color:#999;">Detroit Web Agency &middot; PO Box 36386 &middot; Grosse Pointe, MI 48236</div>
    </div>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { campaign_id, dry_run, prospect_ids } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ── DIAGNOSE / DRY-RUN MODE ────────────────────────────────────────
    if (dry_run) {
      const { data: campaign } = await sb.from("postcard_campaigns").select("*").eq("id", campaign_id).single();
      if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Pull all prospects in this county to build a diagnostic breakdown
      const { data: allInCounty } = await sb
        .from("postcard_prospects")
        .select("id, business_name, city, address_line1, zip, postcard_sent_at, county")
        .ilike("county", campaign.county);

      const total = allInCounty?.length || 0;
      const noAddress = allInCounty?.filter((p: any) => !p.address_line1).length || 0;
      const alreadySent = allInCounty?.filter((p: any) => p.postcard_sent_at).length || 0;
      const ready = allInCounty?.filter((p: any) => p.address_line1 && p.city && p.zip && !p.postcard_sent_at).length || 0;

      // Test Lob API key
      let lobOk = false;
      let lobError: string | null = null;
      if (LOB_API_KEY) {
        try {
          const r = await fetch("https://api.lob.com/v1/postcards?limit=1", {
            headers: { Authorization: `Basic ${btoa(LOB_API_KEY + ":")}` },
          });
          lobOk = r.ok;
          if (!r.ok) lobError = await r.text();
        } catch (e) {
          lobError = e instanceof Error ? e.message : String(e);
        }
      } else {
        lobError = "LOB_API_KEY not set in environment";
      }

      const monthSent = await getMonthSentCount(sb);

      return new Response(JSON.stringify({
        diagnose: true,
        campaign_county: campaign.county,
        prospects_in_county: total,
        no_address: noAddress,
        already_sent: alreadySent,
        ready_to_mail: ready,
        lob_api_ok: lobOk,
        lob_error: lobError,
        month_sent_so_far: monthSent,
        month_remaining: MAX_PER_MONTH - monthSent,
        per_run_cap: MAX_PER_RUN,
        estimated_cost_if_sent: (ready * COST_PER_POSTCARD).toFixed(2),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!LOB_API_KEY) return new Response(JSON.stringify({ error: "LOB_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: campaign, error: campErr } = await sb.from("postcard_campaigns").select("*").eq("id", campaign_id).single();
    if (campErr || !campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const audienceType: AudienceType = campaign.audience_type || "contractor";
    const design = { ...DESIGNS[audienceType] || DESIGNS["contractor"] };
    const city = campaign.county ? `${campaign.county} County` : "Michigan";

    if (campaign.copy_front) design.headline = campaign.copy_front;
    if (campaign.copy_back) design.body = campaign.copy_back;

    // Build query — either by prospect_ids (Resend Failed) or by county filter (default)
    let prospectQuery = sb.from("postcard_prospects").select("*").not("address_line1", "is", null).not("city", "is", null).not("zip", "is", null);

    if (prospect_ids?.length) {
      prospectQuery = prospectQuery.in("id", prospect_ids);
    } else {
      prospectQuery = prospectQuery.ilike("county", campaign.county).is("postcard_sent_at", null).limit(MAX_PER_RUN);
    }

    const { data: prospects } = await prospectQuery;

    if (!prospects?.length) {
      // Honest failure: mark campaign failed, log reason
      const reason = prospect_ids?.length ? "No matching prospects with valid addresses" : `No unsent prospects in ${campaign.county} County with valid addresses`;
      await sb.from("postcard_campaigns").update({ status: "failed", last_error: reason }).eq("id", campaign_id);
      return new Response(JSON.stringify({ error: reason, sent: 0 }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cost guardrails
    if (prospects.length > MAX_PER_RUN) {
      const msg = `🚨 Postcard run BLOCKED: ${prospects.length} > ${MAX_PER_RUN}/run cap`;
      await notifyMatt(msg, `<p>${msg}</p>`);
      await sb.from("postcard_campaigns").update({ status: "failed", last_error: msg }).eq("id", campaign_id);
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const monthSent = await getMonthSentCount(sb);
    if (monthSent + prospects.length > MAX_PER_MONTH) {
      const msg = `🚨 Postcard run BLOCKED: monthly cap. Sent ${monthSent} + this batch ${prospects.length} > ${MAX_PER_MONTH}/month`;
      await notifyMatt(msg, `<p>${msg}</p>`);
      await sb.from("postcard_campaigns").update({ status: "failed", last_error: msg }).eq("id", campaign_id);
      return new Response(JSON.stringify({ error: msg, sent_this_month: monthSent, cap: MAX_PER_MONTH }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      const sendLogBase = {
        prospect_id: prospect.id,
        campaign_id,
        business_name: prospect.business_name || null,
        address_line1: prospect.address_line1 || null,
        city: prospect.city || null,
        state: prospect.state || "MI",
        zip: prospect.zip || null,
        sent_at: new Date().toISOString(),
      };

      try {
        const frontHTML = await buildFrontHTML(design, prospect.city || city, prospect.business_name || "", campaign_id, audienceType);
        const backHTML = buildBackHTML(prospect.city || city);

        const lobRes = await fetch("https://api.lob.com/v1/postcards", {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(LOB_API_KEY + ":")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: `DWA ${audienceType} - ${prospect.business_name}`,
            to: {
              name: prospect.owner_name || prospect.business_name,
              address_line1: prospect.address_line1,
              address_line2: prospect.address_line2 || undefined,
              address_city: prospect.city,
              address_state: prospect.state || "MI",
              address_zip: prospect.zip,
            },
            from: {
              name: "Matt Michels — Detroit Web Agency",
              address_line1: "PO Box 36386",
              address_city: "Grosse Pointe",
              address_state: "MI",
              address_zip: "48236",
            },
            front: frontHTML,
            back: backHTML,
            size: "6x4",
          }),
        });

        if (lobRes.ok) {
          const lobData = await lobRes.json();
          sentCount++;
          await sb.from("postcard_prospects").update({ postcard_sent_at: new Date().toISOString(), postcard_batch_id: campaign_id }).eq("id", prospect.id);
          await sb.from("postcard_send_log").insert({
            ...sendLogBase,
            lob_id: lobData.id,
            status: "sent",
            delivery_status: "queued",
            cost_cents: COST_PER_POSTCARD_CENTS,
            expected_delivery_date: lobData.expected_delivery_date || null,
          });
        } else {
          const errBody = await lobRes.text();
          failedCount++;
          errors.push(`${prospect.business_name}: ${errBody.substring(0, 200)}`);
          await sb.from("postcard_send_log").insert({
            ...sendLogBase,
            status: "failed",
            delivery_status: "failed",
            cost_cents: 0,
            tracking_events: [{ at: new Date().toISOString(), event: "lob_error", body: errBody.substring(0, 1000) }],
          });
        }
      } catch (e) {
        failedCount++;
        const errMsg = e instanceof Error ? e.message : String(e);
        errors.push(`${prospect.business_name}: ${errMsg}`);
        await sb.from("postcard_send_log").insert({
          ...sendLogBase,
          status: "failed",
          delivery_status: "failed",
          cost_cents: 0,
          tracking_events: [{ at: new Date().toISOString(), event: "exception", body: errMsg }],
        });
      }
    }

    // HONEST status update — only mark mailed if at least 1 actually sent
    const newStatus = sentCount > 0 ? "mailed" : "failed";
    const statusUpdate: any = {
      prospect_count: prospects.length,
      sent_count: (campaign.sent_count || 0) + sentCount,
      status: newStatus,
      lob_batch_id: sentCount > 0 ? campaign_id : null,
      total_cost_cents: (campaign.total_cost_cents || 0) + (sentCount * COST_PER_POSTCARD_CENTS),
    };
    if (newStatus === "failed") {
      statusUpdate.last_error = errors.length ? errors.slice(0, 3).join(" | ") : "Zero Lob calls succeeded";
    } else {
      statusUpdate.last_error = null;
    }
    await sb.from("postcard_campaigns").update(statusUpdate).eq("id", campaign_id);

    if (RESEND_API_KEY) {
      const subject = sentCount > 0
        ? `${sentCount} postcards sent — ${audienceType} — ${campaign.county} County`
        : `❌ Postcard send FAILED — ${campaign.county} County (0 sent, ${failedCount} failed)`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "DWA Postcard Engine <matt@detroitwebagent.com>",
          to: ["matthewmichels@gmail.com"],
          subject,
          html: `<div style="font-family:system-ui;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px;">
            <h1 style="color:${sentCount > 0 ? "#00d4ff" : "#f87171"};font-size:24px;">${sentCount > 0 ? "Postcards Sent" : "Send Failed"}</h1>
            <p><strong>${sentCount}</strong> sent · <strong>${failedCount}</strong> failed (of ${prospects.length} attempted)</p>
            <p>Audience: ${audienceType} · ${campaign.county} County</p>
            ${errors.length > 0 ? `<details><summary style="cursor:pointer;color:#f87171;">${errors.length} errors (click)</summary><pre style="background:#161b22;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;">${errors.slice(0, 5).join("\n\n")}</pre></details>` : ""}
          </div>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: sentCount > 0,
      sent: sentCount,
      failed: failedCount,
      total: prospects.length,
      errors: errors.slice(0, 5),
      audience: audienceType,
      status: newStatus,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
