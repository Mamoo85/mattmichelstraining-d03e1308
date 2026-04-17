/**
 * send-postcards
 * Sends physical postcards via Lob API to postcard_prospects.
 * Accepts a campaign_id, looks up the copy + prospects, sends via Lob.
 *
 * MANDATE: Never mention LARA, scraping, databases, or methods. Only "we invented a way."
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

// ── COST GUARDRAILS (Matt: change here to adjust caps) ─────────────────
const MAX_PER_RUN = 500;          // hard cap per send invocation
const MAX_PER_MONTH = 2000;       // hard cap per calendar month
const COST_PER_POSTCARD = 0.85;   // Lob 6x4 estimated cost (USD)

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

async function buildFrontHTML(design: PostcardDesign, city: string, recipientName: string): Promise<string> {
  const qrUrl = `https://detroitwebagent.com${design.qrPath}&city=${city.toLowerCase().replace(/\s+/g, "-")}`;
  const c = design.accentColor;
  // Self-hosted QR — no external dependency at mail time
  const qrDataUri = await qrcode(qrUrl, { size: 260 }) as string;

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
  <div style="width:1.9in;background:#161b22;border-left:3px solid ${c};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0.35in 0.2in;gap:12px;">
    <img src="${DWA_BADGE}" style="width:55px;height:55px;border-radius:50%;border:1.5px solid #30363d;" alt="DWA">
    <div style="font-size:8px;color:#8b949e;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Scan to claim</div>
    <img src="${qrDataUri}" width="130" height="130" style="border-radius:8px;border:2px solid #30363d;" alt="QR">
    <div style="font-size:10px;color:${c};font-weight:800;text-align:center;">${design.offer.includes("MONTH") ? "FREE MONTH" : "FREE 10 NAMES"}</div>
    <div style="font-size:7px;color:#484f58;text-align:center;">detroitwebagent.com</div>
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
    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!LOB_API_KEY) return new Response(JSON.stringify({ error: "LOB_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: campaign, error: campErr } = await sb.from("postcard_campaigns").select("*").eq("id", campaign_id).single();
    if (campErr || !campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Determine design based on campaign audience_type or fall back to trades-agency
    const audienceType: AudienceType = campaign.audience_type || "contractor";
    const design = DESIGNS[audienceType] || DESIGNS["contractor"];
    const city = campaign.county ? `${campaign.county} County` : "Michigan";

    // If campaign has custom copy, use it for body
    if (campaign.copy_front) design.headline = campaign.copy_front;
    if (campaign.copy_back) design.body = campaign.copy_back;

    const { data: prospects } = await sb
      .from("postcard_prospects")
      .select("*")
      .ilike("county", campaign.county)
      .is("postcard_sent_at", null)
      .not("address_line1", "is", null)
      .not("city", "is", null)
      .not("zip", "is", null)
      .limit(MAX_PER_RUN);

    if (!prospects?.length) return new Response(JSON.stringify({ error: "No unsent prospects with valid addresses" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ── COST GUARDRAILS ─────────────────────────────────────────────
    if (prospects.length > MAX_PER_RUN) {
      const msg = `🚨 Postcard run BLOCKED: ${prospects.length} > ${MAX_PER_RUN}/run cap`;
      await notifyMatt(msg, `<p>${msg}</p><p>Edit MAX_PER_RUN in send-postcards/index.ts to change.</p>`);
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const monthSent = await getMonthSentCount(sb);
    if (monthSent + prospects.length > MAX_PER_MONTH) {
      const msg = `🚨 Postcard run BLOCKED: monthly cap. Sent ${monthSent} + this batch ${prospects.length} > ${MAX_PER_MONTH}/month`;
      await notifyMatt(msg, `<p>${msg}</p><p>Edit MAX_PER_MONTH in send-postcards/index.ts to change.</p>`);
      return new Response(JSON.stringify({ error: msg, sent_this_month: monthSent, cap: MAX_PER_MONTH }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const estimatedCost = (prospects.length * COST_PER_POSTCARD).toFixed(2);
    console.log(`[send-postcards] Cost guardrails OK. ${prospects.length} cards × $${COST_PER_POSTCARD} = $${estimatedCost}. Month so far: ${monthSent}/${MAX_PER_MONTH}.`);




    let sentCount = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      try {
        const frontHTML = await buildFrontHTML(design, prospect.city || city, prospect.business_name || "");
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
          sentCount++;
          await sb.from("postcard_prospects").update({ postcard_sent_at: new Date().toISOString(), postcard_batch_id: campaign_id }).eq("id", prospect.id);
        } else {
          const errBody = await lobRes.text();
          errors.push(`${prospect.business_name}: ${errBody}`);
        }
      } catch (e) {
        errors.push(`${prospect.business_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await sb.from("postcard_campaigns").update({
      prospect_count: prospects.length,
      sent_count: (campaign.sent_count || 0) + sentCount,
      status: "mailed",
      lob_batch_id: campaign_id,
    }).eq("id", campaign_id);

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "DWA Postcard Engine <matt@detroitwebagent.com>",
          to: ["matthewmichels@gmail.com"],
          subject: `${sentCount} postcards sent — ${audienceType} — ${campaign.county} County`,
          html: `<div style="font-family:system-ui;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px;">
            <h1 style="color:#00d4ff;font-size:24px;">Postcards Sent!</h1>
            <p><strong>${sentCount}</strong> of ${prospects.length} ${audienceType} postcards mailed to ${campaign.county} County</p>
            <p>Design: ${design.headline} ${design.subline}</p>
            <p>QR: detroitwebagent.com${design.qrPath}</p>
            ${errors.length > 0 ? `<p style="color:#f87171;">${errors.length} errors</p>` : ""}
          </div>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: prospects.length, errors: errors.length, audience: audienceType }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
