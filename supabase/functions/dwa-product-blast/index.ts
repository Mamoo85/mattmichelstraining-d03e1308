// dwa-product-blast — Unified cold-email blast across every DWA product.
// Drains outreach_leads (the actively populated pipeline), routes each lead to
// the best-fit product based on industry, and sends a branded teaser-card email
// with a trial CTA (or direct checkout for non-trial products).
//
// Daily cap default: 200 (deliverability-safe; respects cold_email_ramp_state if set).
// Routing:
//   HVAC/Plumber/Roofer/Electrician/Tree/Restoration/Demo/Foundation/Painter/Gutters/Pest
//                                  → Trade Radar (vertical-matched)
//   General Contractor / Remodeler / Landscaping → Contractor Leads
//   Law firm / Attorney / PI                     → Mortgage Radar (referral angle)
//   Dentist / PT / Clinic / Restaurant / Other   → Missed-Call Catch
// All sends respect outreach-blocklist + marketing-kill-switch.

import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_CAP = parseInt(Deno.env.get("DWA_BLAST_CAP") || "200", 10);
const SITE = "https://detroitwebagent.com";

interface ProductPitch {
  product: string;
  headline: string;
  scoreLabel: string;
  bullets: string[];
  ctaText: string;
  ctaUrl: string;
  badge?: string;
  subject: (biz: string, city: string) => string;
  intro: (firstName: string, biz: string, city: string) => string;
}

function tradeVerticalFromIndustry(ind: string): string | null {
  const i = ind.toLowerCase();
  if (i.includes("hvac")) return "hvac";
  if (i.includes("plumb")) return "plumbing";
  if (i.includes("roof")) return "roofing";
  if (i.includes("electric")) return "electrical";
  if (i.includes("tree")) return "tree";
  if (i.includes("pest")) return "pest_control";
  if (i.includes("gutter")) return "gutters";
  if (i.includes("paint") || i.includes("siding") || i.includes("window")) return "exterior";
  if (i.includes("restor") || i.includes("water damage") || i.includes("mold") || i.includes("fire")) return "restoration";
  if (i.includes("demo") || i.includes("junk")) return "demo_junk";
  if (i.includes("foundation") || i.includes("basement")) return "foundation";
  return null;
}

function pitchFor(lead: any): ProductPitch {
  const industry = (lead.industry || "").toLowerCase();
  const city = lead.city || "Michigan";
  const biz = lead.business_name || "your shop";

  const vertical = tradeVerticalFromIndustry(industry);
  if (vertical) {
    return {
      product: `trade_radar_${vertical}`,
      headline: `🔥 Live ${vertical} job signal — ${city}, MI`,
      scoreLabel: "Score 9/10 · Hot",
      bullets: [
        `New ${vertical} permit + storm/flood signal in ${city} this week`,
        "Owner verified · pre-1990 build · est. job value $8K–$14K",
        "One contractor per lead. No bidding war.",
      ],
      ctaText: "Claim your free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=trade_radar_${vertical}`,
      badge: "TRIAL · 50% off 3 mo",
      subject: (b, c) => `${c} ${vertical} job — ready to be claimed`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nA ${vertical} signal just lit up in ${c} — looks like a fit for ${b}. Trade Radar pulls live permit, storm, and homeowner signals daily across SE Michigan and routes them to one contractor only.\n\nGrab a free 7-day trial and see today's leads:`,
    };
  }
  if (industry.includes("general contractor") || industry.includes("remodel") || industry.includes("landscap") || industry.includes("manufactur") || industry.includes("machine")) {
    return {
      product: "contractor_leads",
      headline: `📣 Verified ${city} buyer looking for a quote`,
      scoreLabel: "Tier A · exclusive",
      bullets: [
        "Homeowner submitted project intent in last 7 days",
        "$5K–$25K project range · phone + email verified",
        "Sold to one contractor only — no shared leads",
      ],
      ctaText: "See open leads →",
      ctaUrl: `${SITE}/start-trial?product=contractor_leads`,
      badge: "EXCLUSIVE",
      subject: (b, c) => `Verified ${c} project lead — exclusive`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nDetroit Web Agency runs Contractor Leads — exclusive (not shared) homeowner project leads in ${c}. We verify the budget, the project, and the phone before a single one gets sold.\n\nWant to see what's open right now?`,
    };
  }
  if (industry.includes("law") || industry.includes("attorney") || industry.includes("injury") || industry.includes("legal")) {
    return {
      product: "mortgage_radar",
      headline: `🏠 ${city} foreclosure & estate signal feed`,
      scoreLabel: "Referral Engine",
      bullets: [
        "Daily court + foreclosure + probate signals in your county",
        "Perfect for refinance, estate planning, bankruptcy referrals",
        "First-look pricing for legal partners",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=mortgage_radar`,
      subject: (b, c) => `${c} foreclosure & estate signal feed`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nMortgage Radar flags daily foreclosure, probate, and estate signals across ${c} — a strong referral source for legal practices. Start the free 7-day trial here:`,
    };
  }
  // Fallback: Missed-Call Catch (universal)
  return {
    product: "missed_call",
    headline: `📞 Stop losing missed calls — ${biz}`,
    scoreLabel: "$99/mo · 7-day trial",
    bullets: [
      "Auto-text every missed call within 30 seconds",
      "Voicemail → transcribed text + Google review push",
      "Most shops recover 3–5 jobs per month",
    ],
    ctaText: "Start free trial →",
    ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
    badge: "TRIAL · 50% off 3 mo",
    subject: (b, c) => `${b} — every missed call is money on the table`,
    intro: (fn, b, c) =>
      `Hey ${fn},\n\nQuick one — when ${b} misses a call, does the customer get an instant text back? If not, you're losing 3–5 paying jobs a month to whoever answers first.\n\nMissed-Call Catch fixes that automatically. Free 7-day trial:`,
  };
}

function plainEmailHtml(lead: any, pitch: ProductPitch): string {
  const fn = lead.first_name || lead.owner_name?.split(" ")[0] || "there";
  const biz = lead.business_name || "your shop";
  const city = lead.city || "Michigan";
  const intro = pitch.intro(fn, biz, city);
  const paragraphs = intro
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ctaUrl = `${pitch.ctaUrl}${pitch.ctaUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(lead.email || "")}&utm_source=product_blast&utm_medium=email`;
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:560px;">
${body}
<p style="margin:0 0 14px;"><a href="${ctaUrl}" style="color:#0a58ca;">${ctaUrl}</a></p>
<p style="margin:18px 0 4px;">— Matt Michels</p>
<p style="margin:0 0 4px;color:#555;">Detroit Web Agency · (313) 992-1219</p>
<p style="margin:14px 0 0;font-size:12px;color:#888;">Reply STOP to opt out. <a href="${SITE}/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color:#888;">Unsubscribe</a>.</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const ks = await isMarketingBlocked(sb);
    if (ks.blocked) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "marketing_kill_switch", detail: ks.reason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_) { /* fail open */ }

  // Pull eligible leads — has email, never SMS-blasted via this product channel before
  const { data: leads, error } = await sb
    .from("outreach_leads")
    .select("id, business_name, owner_name, first_name, email, city, industry, drip_campaign_status")
    .not("email", "is", null)
    .or("drip_campaign_status->>current_stage.is.null,drip_campaign_status->>current_stage.eq.0_New_Extracted_Lead")
    .limit(DAILY_CAP * 2);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let sent = 0, failed = 0, blocked = 0, skipped = 0;
  const byProduct: Record<string, number> = {};

  for (const lead of (leads || [])) {
    if (sent >= DAILY_CAP) break;
    if (!lead.email || !lead.email.includes("@")) { skipped++; continue; }

    try {
      const block = await isBlocked(sb, { email: lead.email, business_name: lead.business_name });
      if (block.blocked) { blocked++; continue; }
    } catch (_) { /* fail open */ }

    const pitch = pitchFor(lead);
    const subject = pitch.subject(lead.business_name || "your shop", lead.city || "Michigan");
    const html = plainEmailHtml(lead, pitch);

    const r = await dwaColdEmail({
      to: lead.email,
      subject,
      bodyHtml: html,
      product: pitch.product,
      ctaUrl: pitch.ctaUrl,
      templateName: `dwa_product_blast_${pitch.product}`,
      plainMode: true,
    }, sb);
    if (r.ok) {
      sent++;
      byProduct[pitch.product] = (byProduct[pitch.product] || 0) + 1;
      await sb.from("outreach_leads").update({
        last_contact_date: new Date().toISOString().slice(0, 10),
        drip_campaign_status: {
          ...(lead.drip_campaign_status || {}),
          current_stage: "1_DWA_Cold_Sent",
          last_engagement_timestamp: new Date().toISOString(),
          last_product_pitched: pitch.product,
        },
      }).eq("id", lead.id);
    } else {
      failed++;
      console.warn("[dwa-product-blast]", lead.email, r.error);
    }

    // Pace ~1 email per 1.5s
    await new Promise((r) => setTimeout(r, 1500));
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, blocked, skipped, byProduct, cap: DAILY_CAP }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
