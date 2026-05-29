import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { dashboardPreviewHtml, pickProductForIndustry, missedRevenue } from "../_shared/dashboard-preview.ts";
import { teaserCardHtml } from "../_shared/teaser-card.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[MULTI-SERVICE-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// THROTTLED: Web design outreach is the priority. Automation pitches are secondary.
// Only 5 per run, with longer delays between steps so web design drip has room.
// Raised cap to contribute meaningfully to the 150/day cold-email floor.
const MAX_LEADS_PER_RUN = 35;
const SEND_DELAY_MS = 500;

// ── INDUSTRY → DEMO LINK MAPPING ──
const SITE_BASE = "https://www.detroitwebagent.com";
const DEMO_MAP: { keywords: string[]; path: string; label: string }[] = [
  { keywords: ["dental", "dentist", "orthodont", "prosthodont", "oral"], path: "/demo-dental", label: "dental practice" },
  { keywords: ["medical", "clinic", "doctor", "physician", "health", "urgent care", "chiropr"], path: "/demo-clinic", label: "medical clinic" },
  { keywords: ["roof", "roofing"], path: "/demo-roofing", label: "roofing company" },
  { keywords: ["hvac", "heating", "cooling", "air condition"], path: "/demo-hvac", label: "HVAC company" },
  { keywords: ["plumb"], path: "/demo-plumber", label: "plumbing company" },
  { keywords: ["electri"], path: "/demo-electrician", label: "electrical contractor" },
  { keywords: ["landscap", "lawn", "garden", "tree service"], path: "/demo-landscape", label: "landscaping company" },
  { keywords: ["auto", "mechanic", "car repair", "body shop", "collision"], path: "/demo-auto-repair", label: "auto repair shop" },
  { keywords: ["clean", "maid", "janitorial"], path: "/demo-cleaning", label: "cleaning service" },
  { keywords: ["salon", "spa", "barber", "beauty", "nail", "hair"], path: "/demo-salon", label: "salon / spa" },
  { keywords: ["restaurant", "bar", "cafe", "pizza", "grill", "food", "catering", "bakery"], path: "/demo-restaurant", label: "restaurant" },
  { keywords: ["law", "attorney", "legal", "lawyer"], path: "/demo-lawyer", label: "law firm" },
  { keywords: ["real estate", "realtor", "realty", "broker", "property"], path: "/demo-real-estate", label: "real estate" },
  { keywords: ["manufactur", "industrial", "automation", "boiler", "machine shop", "fabricat", "weld"], path: "/demo-youngblood", label: "industrial / manufacturing" },
  { keywords: ["pet", "vet", "veterinar", "grooming", "animal"], path: "/demo-petfection", label: "pet business" },
];

function getDemoLink(industry?: string): { url: string; label: string } | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();
  for (const entry of DEMO_MAP) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return { url: `${SITE_BASE}${entry.path}`, label: entry.label };
    }
  }
  if (lower.includes("contract") || lower.includes("home service") || lower.includes("handyman") || lower.includes("paint") || lower.includes("fenc")) {
    return { url: `${SITE_BASE}/demo-roofing`, label: "contractor" };
  }
  return null;
}

interface ServiceOffer {
  name: string;
  price: string;
  slug: string;
}

// ── COMPREHENSIVE INDUSTRY → SERVICE MAPPING (40+ SERVICES) ──
function getServicesForIndustry(industry: string): ServiceOffer[] {
  const n = (industry || "").toLowerCase();

  // Contractors / Home Services
  if (["hvac", "plumb", "roof", "electri", "landscap", "handyman", "concrete", "fence", "deck", "paint", "gutter", "siding", "flooring", "remodel", "general contractor"].some(k => n.includes(k))) {
    return [
      { name: "Missed Call Text-Back", price: "$99/mo", slug: "missed-call-text-back" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "Quote Follow-Up SMS", price: "$49/mo", slug: "quote-followup-sms" },
      { name: "Contractor Invoicing", price: "$29/mo", slug: "contractor-invoicing" },
      { name: "Speed-to-Lead SMS", price: "$39/mo", slug: "speed-to-lead" },
      { name: "AI Estimate Generator", price: "$49/mo", slug: "estimate-generator" },
    ];
  }

  // Restaurants / Food / Bars
  if (["restaurant", "food", "bar", "cafe", "bakery", "diner", "pizza", "catering", "food truck", "brewery"].some(k => n.includes(k))) {
    return [
      { name: "Text Message Marketing", price: "$79/mo", slug: "text-marketing" },
      { name: "Social Media AI", price: "$199/mo", slug: "social-media-ai" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "Birthday Campaign SMS", price: "$39/mo", slug: "birthday-campaign" },
      { name: "Inventory Alert System", price: "$49/mo", slug: "inventory-alerts" },
      { name: "Win-Back SMS", price: "$49/mo", slug: "winback-sms" },
    ];
  }

  // Retail / Salon / Spa / Gym
  if (["retail", "salon", "spa", "gym", "fitness", "nail", "barber", "beauty", "boutique", "shop"].some(k => n.includes(k))) {
    return [
      { name: "Text Message Marketing", price: "$79/mo", slug: "text-marketing" },
      { name: "Appointment Reminders", price: "$39/mo", slug: "appointment-reminders" },
      { name: "Birthday Campaign SMS", price: "$39/mo", slug: "birthday-campaign" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "Social Media AI", price: "$199/mo", slug: "social-media-ai" },
    ];
  }

  // Medical / Dental / Healthcare
  if (["medical", "dental", "healthcare", "clinic", "doctor", "dentist", "chiro", "optom", "pharma", "veterinar", "therapy", "counseling"].some(k => n.includes(k))) {
    return [
      { name: "AI Reputation Dashboard", price: "$79/mo", slug: "reputation-dashboard" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "AI Phone Answering", price: "$149/mo", slug: "phone-answering" },
      { name: "Appointment Reminders", price: "$39/mo", slug: "appointment-reminders" },
      { name: "HIPAA-Ready AI FAQ Refresh", price: "$49/mo", slug: "faq-refresh" },
    ];
  }

  // Real Estate / Insurance / Financial
  if (["real estate", "insurance", "realtor", "broker", "mortgage", "financial", "accounting", "tax", "cpa"].some(k => n.includes(k))) {
    return [
      { name: "AI Phone Answering", price: "$149/mo", slug: "phone-answering" },
      { name: "AI Blog Post Service", price: "$79/mo", slug: "blog-posts" },
      { name: "Speed-to-Lead SMS", price: "$39/mo", slug: "speed-to-lead" },
      { name: "AI Meeting Prep", price: "$29/mo", slug: "meeting-prep" },
      { name: "AI Proposal Generator", price: "$79/mo", slug: "proposal-generator" },
    ];
  }

  // Legal
  if (["law", "legal", "attorney", "lawyer"].some(k => n.includes(k))) {
    return [
      { name: "AI Phone Answering", price: "$149/mo", slug: "phone-answering" },
      { name: "Speed-to-Lead SMS", price: "$39/mo", slug: "speed-to-lead" },
      { name: "AI Reputation Dashboard", price: "$79/mo", slug: "reputation-dashboard" },
      { name: "AI Blog Post Service", price: "$79/mo", slug: "blog-posts" },
    ];
  }

  // Auto / Towing / Mechanic
  if (["auto", "towing", "mechanic", "car wash", "tire", "body shop", "collision"].some(k => n.includes(k))) {
    return [
      { name: "Missed Call Text-Back", price: "$99/mo", slug: "missed-call-text-back" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "AI Reputation Dashboard", price: "$79/mo", slug: "reputation-dashboard" },
      { name: "Quote Follow-Up SMS", price: "$49/mo", slug: "quote-followup-sms" },
      { name: "Text Message Marketing", price: "$79/mo", slug: "text-marketing" },
    ];
  }

  // Cleaning / Pest / Junk / Moving
  if (["clean", "pest", "junk", "moving", "hauling", "pressure wash", "maid", "janitorial"].some(k => n.includes(k))) {
    return [
      { name: "Missed Call Text-Back", price: "$99/mo", slug: "missed-call-text-back" },
      { name: "AI Estimate Generator", price: "$49/mo", slug: "estimate-generator" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "Speed-to-Lead SMS", price: "$39/mo", slug: "speed-to-lead" },
      { name: "Win-Back SMS", price: "$49/mo", slug: "winback-sms" },
    ];
  }

  // Manufacturing / Industrial / Warehouse
  if (["manufactur", "industrial", "warehouse", "fabricat", "metal", "plastic", "injection", "cnc", "machin"].some(k => n.includes(k))) {
    return [
      { name: "AI Employee Handbook", price: "$79/mo", slug: "employee-handbook" },
      { name: "OSHA Compliance Monitor", price: "$99/mo", slug: "osha-compliance" },
      { name: "AI Permit & License Monitor", price: "$79/mo", slug: "permit-monitor" },
      { name: "AI Inventory Alert System", price: "$49/mo", slug: "inventory-alerts" },
      { name: "AI Job Posting Writer", price: "$19/mo", slug: "job-posting" },
    ];
  }

  // Construction / Commercial
  if (["construct", "commercial contractor", "property manage", "building"].some(k => n.includes(k))) {
    return [
      { name: "AI Estimate Generator", price: "$49/mo", slug: "estimate-generator" },
      { name: "AI Proposal Generator", price: "$79/mo", slug: "proposal-generator" },
      { name: "OSHA Compliance Monitor", price: "$99/mo", slug: "osha-compliance" },
      { name: "AI Permit & License Monitor", price: "$79/mo", slug: "permit-monitor" },
      { name: "Collections Manager", price: "$99/mo", slug: "collections" },
    ];
  }

  // Pet / Animal / Dog Grooming
  if (["pet", "dog", "groom", "vet", "animal", "kennel", "board"].some(k => n.includes(k))) {
    return [
      { name: "Appointment Reminders", price: "$39/mo", slug: "appointment-reminders" },
      { name: "Birthday Campaign SMS", price: "$39/mo", slug: "birthday-campaign" },
      { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
      { name: "Social Media AI", price: "$199/mo", slug: "social-media-ai" },
    ];
  }

  // B2B / Consulting / Agencies / SaaS
  if (["consult", "agency", "marketing", "saas", "b2b", "staffing", "recruit"].some(k => n.includes(k))) {
    return [
      { name: "AI Competitor Watch", price: "$99/mo", slug: "competitor-watch" },
      { name: "AI Meeting Prep", price: "$29/mo", slug: "meeting-prep" },
      { name: "AI Market Intel Brief", price: "$79/mo", slug: "market-intel" },
      { name: "AI Sales Battlecards", price: "$59/mo", slug: "battlecards" },
      { name: "AI Newsletter Service", price: "$99/mo", slug: "newsletter-service" },
    ];
  }

  // Default — covers anything not matched
  return [
    { name: "AI Reputation Dashboard", price: "$79/mo", slug: "reputation-dashboard" },
    { name: "Missed Call Text-Back", price: "$99/mo", slug: "missed-call-text-back" },
    { name: "Social Media AI", price: "$199/mo", slug: "social-media-ai" },
    { name: "Review Request SMS", price: "$39/mo", slug: "review-request-sms" },
    { name: "Speed-to-Lead SMS", price: "$39/mo", slug: "speed-to-lead" },
  ];
}

// ── 3-STEP DRIP SEQUENCE ──
// Step 1: Industry-specific pitch (day 0 after initial web-design drip completes)
// Step 2: Social proof + urgency (day 3)
// Step 3: Final offer with discount hook (day 7)
const DRIP_TEMPLATES = [
  "multi_service_pitch_1",
  "multi_service_pitch_2",
  "multi_service_pitch_3",
];

function buildMultiServiceEmailHtml(subject: string, body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#22d3ee;padding:3px 0;"></td></tr>
    <tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
      ${htmlBody}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
        <img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
        <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · (313) 992-1219</div>
        <img src="https://www.detroitwebagent.com/images/dwa-logo.png" alt="Detroit Web Agency" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Prefer to just text? (313) 992-1219</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
      Matt Michels · Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219<br>
      <a href="https://www.detroitwebagent.com" style="color:#94a3b8;">detroitwebagent.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function buildMultiBody(
  stepIndex: number,
  biz: string,
  industry: string,
  city: string,
  productLabel: string,
  revenueUsd: string,
  demo: { url: string; label: string } | null,
): string {
  const ind = industry || "local business";
  const demoLine = demo ? `\n\nSee what I built for a ${demo.label}: ${demo.url}` : "";
  const cta = `detroitwebagent.com/get-started`;

  if (stepIndex === 0) {
    return `Hey —\n\nI build websites specifically for ${ind} businesses and pair every site with ${productLabel} — so you can see the leads and signals it generates.\n\nBased on what I see in ${city}, businesses like ${biz} are leaving roughly ${revenueUsd}/mo on the table from missed opportunities.${demoLine}\n\nTakes 30 seconds: ${cta}\n\n— Matt, Detroit Web Agency · Grosse Pointe\n(313) 992-1219`;
  }

  if (stepIndex === 1) {
    return `Hey —\n\nCircling back from last week on ${biz}.\n\nA ${ind} client I recently set up went from zero visibility into inbound interest to knowing exactly which companies were checking them out before calling. They closed 3 deals in the first month that would have been invisible.\n\nPaired with the website, it's a complete inbound machine for under $300/mo.${demoLine}\n\nSee what I'd set up: ${cta}\n\n— Matt, Detroit Web Agency\n(313) 992-1219`;
  }

  return `Hey —\n\nLast note from me.\n\nIf a website built for ${ind} businesses + ${productLabel} to surface the leads it generates ever makes sense for ${biz}, the door's open anytime.${demoLine}\n\n${cta} or text: (313) 992-1219\n\n— Matt, Detroit Web Agency`;
}



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Query outreach_leads: status = 'Emailed', email not null
    const { data: leads, error: leadsErr } = await serviceClient
      .from("outreach_leads" as any)
      .select("id, business_name, email, industry, city, status")
      .eq("status", "Emailed")
      .not("email", "is", null)
      .not("email", "eq", "")
      .limit(100);

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      log("No Emailed leads found");
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No eligible leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Fetched Emailed leads", { count: leads.length });

    let sent = 0;
    let processed = 0;

    for (const lead of leads) {
      if (processed >= MAX_LEADS_PER_RUN) break;

      try {
        const leadId: string = lead.id;
        const email: string = lead.email;
        const businessName: string = lead.business_name || "your business";
        const industry: string = lead.industry || "";
        const city: string = lead.city || "your area";

        // Check which drip steps already sent
        const { data: sentLogs } = await serviceClient
          .from("email_send_log" as any)
          .select("template_name, created_at")
          .eq("recipient_email", email)
          .like("template_name", "multi_service_pitch_%")
          .order("created_at", { ascending: false });

        const sentTemplates = new Set((sentLogs || []).map((l: any) => l.template_name));
        const lastSent = sentLogs?.[0];
        const daysSinceLastSent = lastSent
          ? (Date.now() - new Date(lastSent.created_at).getTime()) / 86400000
          : 999;

        // Find next step
        let stepIndex = -1;
        const STEP_DELAYS = [0, 3, 4]; // days between steps
        // Longer delays so web design drip dominates inbox real estate
        const ADJUSTED_STEP_DELAYS = [7, 7, 7]; // wait 7 days between each automation pitch
        for (let i = 0; i < DRIP_TEMPLATES.length; i++) {
          if (!sentTemplates.has(DRIP_TEMPLATES[i])) {
            if (i === 0 || daysSinceLastSent >= ADJUSTED_STEP_DELAYS[i]) {
              stepIndex = i;
            }
            break;
          }
        }

        if (stepIndex === -1) {
          // All steps sent or not due yet
          continue;
        }

        processed++;

        // Pick the ONE radar product that fits this industry — never the
        // add-on salad. Cold pitch = website + one real lead/hire product.
        const productKey = pickProductForIndustry(industry);
        const productLabel = ({
          trade_radar: "Trade Radar",
          mortgage_radar: "Mortgage Radar",
          techalert: "TechAlert",
          missed_call: "Missed-Call Catch",
          siteradar: "SiteRadar",
          fielddesk: "FieldDesk",
        } as Record<string, string>)[productKey];
        const revenue = missedRevenue(productKey);
        const revenueUsd = "$" + revenue.toLocaleString("en-US");

        const demo = getDemoLink(industry);
        const emailBody: string = buildMultiBody(stepIndex, businessName, industry, city, productLabel, revenueUsd, demo);

        const subjectLines = [
          `${businessName} — ~${revenueUsd}/mo we'd help you capture`,
          `Quick follow-up for ${businessName}`,
          `Last note from me, ${businessName}`,
        ];
        const subject = subjectLines[stepIndex];
        const ctaUrl = demo?.url || "https://detroitwebagent.com/get-started";

        const previewHtml = dashboardPreviewHtml({
          product: productKey,
          city: city,
          industry: industry,
        });

        // Plain mode: human-looking, no dark template, no preview card. Better inbox placement.
        const plainBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:600px;">${emailBody.replace(/\n/g, "<br>")}<br><br><a href="${ctaUrl}">See what I'd build for you →</a></div>`;
        const r = await dwaColdEmail({
          to: email,
          subject,
          bodyHtml: plainBody,
          product: "Web Design Build",
          ctaUrl,
          ctaText: "See what I'd build for you →",
          templateName: DRIP_TEMPLATES[stepIndex],
          plainMode: true,
        }, serviceClient);

        if (!r.ok) {
          log("Send error", { leadId, email, error: r.error });
          continue;
        }

        const messageId = r.messageId || `multi_${leadId}_${stepIndex}`;

        sent++;
        log("Email sent", { leadId, email, businessName, step: stepIndex + 1, industry });

        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      } catch (err) {
        log("Per-lead error", { leadId: lead.id, error: String(err) });
      }
    }

    log("Run complete", { sent, processed });
    return new Response(JSON.stringify({ ok: true, sent, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("FATAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
