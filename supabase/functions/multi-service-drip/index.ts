import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[MULTI-SERVICE-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const MAX_LEADS_PER_RUN = 10;
const SEND_DELAY_MS = 300;

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
    <tr><td style="background:#e8621a;padding:3px 0;"></td></tr>
    <tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
      ${htmlBody}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
        <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Prefer to just text? (313) 806-4952</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
      Matt Michels · M² Development · Grosse Pointe, MI · (313) 806-4952<br>
      <a href="https://www.mattmichelstraining.com" style="color:#94a3b8;">mattmichelstraining.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const STEP_PROMPTS = [
  // Step 1: Industry-specific intro
  (biz: string, industry: string, city: string, serviceList: string) =>
    `Write a SHORT email (under 120 words) to ${biz}, a ${industry || "local business"} in ${city}. Introduce these services that could help them grow. Keep it casual, local, direct. Start with "Hey —". End with "— Matt". Mention you're based in Grosse Pointe MI. Include a CTA: "Takes 30 seconds: mattmichelstraining.com/get-started"\n\nServices:\n${serviceList}`,

  // Step 2: Social proof follow-up
  (biz: string, industry: string, city: string, serviceList: string) =>
    `Write a SHORT follow-up email (under 100 words) to ${biz}. You emailed them a few days ago about automation tools. Now share a quick win story — mention that a similar ${industry} business saved 10+ hours/week using your tools. Be specific about which service helped most. Casual tone. Start with "Hey —". End with "— Matt". CTA: "See what I'd set up for you: mattmichelstraining.com/get-started"`,

  // Step 3: Final touch with urgency
  (biz: string, industry: string, city: string, serviceList: string) =>
    `Write a FINAL short email (under 80 words) to ${biz}. Last message, no hard feelings if not interested. Mention you only work with a limited number of ${industry} businesses per area so you can give real attention. If timing's ever right, your door's open. Start with "Hey —". End with "— Matt". CTA: "mattmichelstraining.com/get-started or text (313) 806-4952"`,
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

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
        for (let i = 0; i < DRIP_TEMPLATES.length; i++) {
          if (!sentTemplates.has(DRIP_TEMPLATES[i])) {
            if (i === 0 || daysSinceLastSent >= STEP_DELAYS[i]) {
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

        const services = getServicesForIndustry(industry);
        const serviceList = services
          .map((s) => `• ${s.name} — ${s.price}`)
          .join("\n");

        const promptFn = STEP_PROMPTS[stepIndex];
        const prompt = promptFn(businessName, industry, city, serviceList);

        const claudeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are Matt Michels, local business consultant in Grosse Pointe MI. Casual, direct, personal tone. You run M² Development." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          log("AI API error", { leadId, error: errText });
          continue;
        }

        const claudeJson = await claudeRes.json();
        const emailBody: string =
          claudeJson?.choices?.[0]?.message?.content?.trim() ||
          `Hey —\n\nI wanted to reach out about a few tools that might help ${businessName} get more calls and grow.\n\nHere's what I offer:\n${serviceList}\n\nAll automated — no extra work on your end.\n\nmattmichelstraining.com/get-started\n\n— Matt`;

        const subjectLines = [
          `A few tools that could help ${businessName}`,
          `Quick follow-up for ${businessName}`,
          `Last note from me, ${businessName}`,
        ];
        const subject = subjectLines[stepIndex];
        const html = buildMultiServiceEmailHtml(subject, emailBody);

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            reply_to: "matt@m2training.com",
            to: [email],
            subject,
            html,
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          log("Resend error", { leadId, email, error: errText });
          continue;
        }

        const resendJson = await resendRes.json();
        const messageId: string = resendJson?.id || `multi_${leadId}_${stepIndex}`;

        await serviceClient
          .from("email_send_log" as any)
          .insert({
            recipient_email: email,
            template_name: DRIP_TEMPLATES[stepIndex],
            status: "sent",
            message_id: messageId,
            metadata: { lead_id: leadId, step: stepIndex + 1, industry, city, services_pitched: services.map(s => s.name) },
          });

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
