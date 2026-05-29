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
//   Salon / Barber / Nail / Spa / Cosmetology    → Missed-Call Catch (chair-time pitch)
//   Dental / Dentist / Orthodontic               → Missed-Call Catch (procedure value pitch)
//   Auto Repair / Body Shop / Mechanic            → Missed-Call Catch (estimate-first pitch)
//   Physical Therapy / Rehab / Chiropractic       → Missed-Call Catch (insurance auth pitch)
//   Veterinary / Animal Hospital / Pet Clinic     → Missed-Call Catch (urgent care pitch)
//   Restaurant / Bar / Cafe                       → Missed-Call Catch (reservation pitch)
//   Everything else                               → Missed-Call Catch (universal)
// All sends respect outreach-blocklist + marketing-kill-switch.

import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isMarketingBlocked } from "../_shared/marketing-kill-switch.ts";
import { wasRecentlyEmailed } from "../_shared/cold-email-dedup.ts";

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
  // SALON / BARBER / SPA / NAIL / COSMETOLOGY — stylists can't answer while at the chair
  if (industry.includes("salon") || industry.includes("barber") || industry.includes("spa") || industry.includes("nail") || industry.includes("cosmet") || industry.includes("beauty")) {
    return {
      product: "missed_call",
      headline: `📞 Every missed booking is $80 walking out the door — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "Stylists can't answer while they're at the chair — clients book whoever calls back first",
        "Auto-text every missed call within 30 seconds keeps your chair booked",
        "Recover 4–8 missed appointments per month on average",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — your stylists can't answer and book at the same time`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nWhen a client calls ${b} and hits voicemail, they book the next salon that picks up. Missed-Call Catch auto-texts every missed caller within 30 seconds — most salons recover 4–8 appointments a month they used to lose.\n\nFree 7-day trial, no card:`,
    };
  }
  // DENTAL / DENTIST / ORTHODONTIC — every missed call is a $500+ procedure
  if (industry.includes("dental") || industry.includes("dentist") || industry.includes("orthodont") || industry.includes("oral")) {
    return {
      product: "missed_call",
      headline: `📞 Every missed call is a $500 procedure walking out — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "New patients call 3 offices — whoever calls back first wins the appointment",
        "Missed-Call Catch texts every missed caller in 30 sec, 24/7",
        "Pay for itself with one recovered crown or cleaning consult",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — every missed patient call is a $500 procedure someone else got`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nDental front desks get overwhelmed. When a new patient calls ${b} and gets voicemail, they move to the next office on Google. Missed-Call Catch texts them back in 30 seconds automatically — capturing patients your front desk couldn't reach.\n\nFree 7-day trial:`,
    };
  }
  // AUTO REPAIR / BODY SHOP / MECHANIC — first shop to call back the estimate wins
  if (industry.includes("auto repair") || industry.includes("auto body") || industry.includes("mechanic") || industry.includes("automotive") || industry.includes("collision") || industry.includes("tire")) {
    return {
      product: "missed_call",
      headline: `📞 First shop to call back the estimate wins — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "People price 3 shops — whoever calls back first almost always gets the job",
        "Auto-text every missed estimate call within 30 seconds",
        "Most shops recover 2–4 extra jobs per month",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — are you the first shop to call back on estimates?`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nWhen someone needs an estimate, they call 3 shops. Whoever calls back first almost always gets the job. Missed-Call Catch auto-texts every missed caller so ${b} is always first — no matter how busy the bay is.\n\nFree 7-day trial:`,
    };
  }
  // PHYSICAL THERAPY / CHIROPRACTIC / REHAB / CLINIC — insurance callbacks are time-sensitive
  if (industry.includes("physical therapy") || industry.includes("chiropr") || industry.includes("rehab") || industry.includes("pt clinic") || industry.includes("occupational therapy")) {
    return {
      product: "missed_call",
      headline: `📞 Missed insurance callbacks cost you claims — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "Insurance authorization calls must be returned same-day or you lose the claim",
        "New patient calls go to whoever calls back first",
        "Auto-text every missed call within 30 seconds, 24/7",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — missed insurance callbacks are costing you claims`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nInsurance auth callbacks need same-day returns or you lose the claim. New patient calls go to whoever responds first. Missed-Call Catch texts every missed caller instantly — new patients and auth callbacks never fall through the cracks at ${b}.\n\nFree 7-day trial:`,
    };
  }
  // VETERINARY / ANIMAL HOSPITAL / PET CLINIC — urgent calls have zero patience for voicemail
  if (industry.includes("veterinar") || industry.includes("animal hospital") || industry.includes("pet clinic") || industry.includes("pet care") || industry.includes("animal care")) {
    return {
      product: "missed_call",
      headline: `📞 Pet owners in distress don't leave voicemails twice — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "Sick-pet calls are urgent — owners call every vet on Google until someone answers",
        "Auto-text every missed call within 30 seconds keeps patients from going elsewhere",
        "Most clinics recover 3–6 patient visits per month",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — pet owners in distress won't wait for a callback`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nWhen a pet owner has a sick animal, they call every vet clinic on Google. Missed-Call Catch texts every missed caller at ${b} within 30 seconds — keeping your exam rooms full and clients loyal.\n\nFree 7-day trial:`,
    };
  }
  // RESTAURANT / BAR / CAFE — reservation calls go to whoever picks up
  if (industry.includes("restaurant") || industry.includes("bar ") || industry.includes("cafe") || industry.includes("catering") || industry.includes("diner") || industry.includes("bistro")) {
    return {
      product: "missed_call",
      headline: `📞 Reservation calls go to whoever picks up — ${biz}`,
      scoreLabel: "$99/mo · 7-day trial",
      bullets: [
        "Friday night reservation calls hit when your staff is busiest — and get missed",
        "Auto-text every missed call within 30 seconds to capture the reservation",
        "Works during rush — no staff involvement needed",
      ],
      ctaText: "Start free 7-day trial →",
      ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
      badge: "TRIAL",
      subject: (b, c) => `${b} — reservation calls during the rush are going to voicemail`,
      intro: (fn, b, c) =>
        `Hey ${fn},\n\nFriday night at ${b} — phones are ringing and your staff is slammed. Those missed reservation calls go to the restaurant that answers. Missed-Call Catch texts every missed caller back in 30 seconds automatically.\n\nFree 7-day trial:`,
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
      "Most businesses recover 3–5 jobs per month",
    ],
    ctaText: "Start free trial →",
    ctaUrl: `${SITE}/start-trial?product=missed_call_catch`,
    badge: "TRIAL · 50% off 3 mo",
    subject: (b, c) => `${b} — every missed call is a customer you didn't get`,
    intro: (fn, b, c) =>
      `Hey ${fn},\n\nQuick one — when ${b} misses a call, does the customer get an instant text back? If not, you're losing paying customers to whoever answers first.\n\nMissed-Call Catch fixes that automatically. Free 7-day trial:`,
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

  // Honor the deliverability ramp: email-deliverability-check / ramp-scheduler set
  // cold_email_ramp_state.paused on a bounce/complaint spike. Without this the blast
  // would keep sending through a reputation problem.
  let effectiveCap = DAILY_CAP;
  try {
    const { data: ramp } = await sb
      .from("cold_email_ramp_state").select("paused, current_cap").eq("id", 1).maybeSingle();
    if (ramp?.paused) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "ramp_paused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof ramp?.current_cap === "number" && ramp.current_cap > 0) {
      effectiveCap = Math.min(DAILY_CAP, ramp.current_cap);
    }
  } catch (_) { /* fail open — never block sends on a tracking read error */ }

  // Pull eligible leads — has email, never SMS-blasted via this product channel before
  const { data: leads, error } = await sb
    .from("outreach_leads")
    .select("id, business_name, owner_name, first_name, email, city, industry, drip_campaign_status")
    .not("email", "is", null)
    .or("drip_campaign_status->>current_stage.is.null,drip_campaign_status->>current_stage.eq.0_New_Extracted_Lead")
    .limit(effectiveCap * 2);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let sent = 0, failed = 0, blocked = 0, skipped = 0;
  const byProduct: Record<string, number> = {};

  for (const lead of (leads || [])) {
    if (sent >= effectiveCap) break;
    if (!lead.email || !lead.email.includes("@")) { skipped++; continue; }

    try {
      const block = await isBlocked(sb, { email: lead.email, business_name: lead.business_name });
      if (block.blocked) { blocked++; continue; }
    } catch (_) { /* fail open */ }

    // Cross-product dedup — skip if any DWA cold email already sent in last 5 days
    if (await wasRecentlyEmailed(sb, lead.email)) { skipped++; continue; }

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

  return new Response(JSON.stringify({ ok: true, sent, failed, blocked, skipped, byProduct, cap: effectiveCap }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
