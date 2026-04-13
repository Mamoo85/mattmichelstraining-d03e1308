// NEO — Autonomous Lead Outreach Engine
// 2pm ET daily: finds A-tier prospects, writes personalized cold emails in
// Matt's voice using Claude Haiku, sends up to 20/day via Resend.
// Schedules follow-ups automatically. Only bothers Matt when someone replies.
//
// Enhanced beyond basic outreach:
//   - Claude Haiku writes each email uniquely — references business name, industry, city
//   - A/B tests subject lines (tracks which convert)
//   - Segments pitch by business profile (bad website → audit, active GBP → GBP SaaS)
//   - Auto follow-up on day 3 and day 7 if no response
//   - Daily cap: 20 emails to protect sender reputation
//   - Never contacts a prospect twice if they replied or said no
//   - Checks suppressed_emails before every send (CAN-SPAM compliance)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const DAILY_SEND_LIMIT = 20;

// Matt's own test emails — never run outreach to these
const TEST_EMAILS = ["matt@mattmichelstraining.com", "matt@detroitwebagent.com", "matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

// ── INDUSTRY → DEMO LINK MAPPING ──
const BASE = "https://www.detroitwebagent.com";
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
      return { url: `${BASE}${entry.path}`, label: entry.label };
    }
  }
  if (lower.includes("contract") || lower.includes("home service") || lower.includes("handyman") || lower.includes("paint") || lower.includes("fenc")) {
    return { url: `${BASE}/demo-roofing`, label: "contractor" };
  }
  return null;
}

// ── INDUSTRY CLASSIFICATION ──
const MANUFACTURER_KEYWORDS = [
  "manufactur", "fabricat", "machine shop", "industrial", "chemical", "plastics",
  "metal", "steel", "weld", "foundry", "stamping", "die cast", "assembly",
  "processing", "packaging", "boiler", "automation", "cnc", "tooling",
  "food processing", "pharma", "textil", "lumber", "paper", "glass",
];
const SUBCONTRACTOR_KEYWORDS = [
  "electric", "plumb", "hvac", "heating", "cooling", "roof", "concrete",
  "excavat", "demol", "drywall", "paint", "floor", "tile", "masonry",
  "insulation", "fire protect", "sprinkler", "iron work", "steel erect",
  "sheet metal", "glazing", "landscape", "paving", "fenc", "weld",
  "mechanical", "piping", "scaffold", "crane",
];

function classifyIndustry(industry?: string): "manufacturer" | "subcontractor" | "general" {
  if (!industry) return "general";
  const lower = industry.toLowerCase();
  if (MANUFACTURER_KEYWORDS.some(k => lower.includes(k))) return "manufacturer";
  if (SUBCONTRACTOR_KEYWORDS.some(k => lower.includes(k))) return "subcontractor";
  return "general";
}

// Determine the best product pitch for each business profile
function selectPitch(business: { industry?: string; has_website?: boolean; rating?: number; review_count?: number }) {
  const classification = classifyIndustry(business.industry);

  if (!business.has_website) {
    if (classification === "manufacturer") {
      return { product: "web_design", cta: "a website that actually gets you calls — and it comes pre-loaded with our compliance monitoring dashboard so you never miss an EPA or OSHA filing. We actually put together a free scan for manufacturers like you — check it out here: https://www.detroitwebagent.com/free-compliance-scan", price: "$499" };
    }
    if (classification === "subcontractor") {
      return { product: "web_design", cta: "a website that actually gets you calls — plus it comes with our AI bid board that finds open jobs in your area automatically. We put together a free report showing open bids in your trade — grab it here: https://www.detroitwebagent.com/free-bid-report", price: "$499" };
    }
    return { product: "web_design", cta: "a website that actually gets you calls", price: "$499" };
  }

  if ((business.review_count || 0) < 30 || (business.rating || 0) < 4.5) {
    if (classification === "manufacturer") {
      return { product: "web_design", cta: "a modern website redesign that ranks on Google — we'll also set up automated compliance monitoring for your EPA/OSHA filings at no extra cost. Here's a free scan we run for manufacturers: https://www.detroitwebagent.com/free-compliance-scan", price: "$499" };
    }
    if (classification === "subcontractor") {
      return { product: "web_design", cta: "a modern website redesign that ranks on Google — plus we'll activate our bid intelligence tool that finds open commercial jobs matching your trade. Grab your free bid report here: https://www.detroitwebagent.com/free-bid-report", price: "$499" };
    }
    return { product: "web_design", cta: "a modern website redesign that ranks on Google and converts visitors into calls", price: "$499" };
  }

  return { product: "gbp_saas", cta: "automated Google posts 3x/week to stay visible", price: "$49/mo" };
}

// ── SUPPRESSION CHECK ──
async function isEmailSuppressed(sb: any, email: string): Promise<boolean> {
  const { data } = await sb
    .from("suppressed_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

async function writePersonalizedEmail(business: {
  business_name: string;
  industry?: string;
  city?: string;
  phone?: string;
  pitch: { product: string; cta: string; price: string };
}): Promise<{ subject: string; body: string }> {
  const demo = getDemoLink(business.industry);
  const demoLine = demo ? `\n\nHere's what I built for a ${demo.label} — takes 10 seconds to look: ${demo.url}` : "";

  if (!LOVABLE_API_KEY) {
    return {
      subject: `Quick question about ${business.business_name}`,
      body: `Hey, my name's Matt Michels — I'm based out of Grosse Pointe and I do web work for local businesses.\n\nI was looking at your Google listing for ${business.business_name} and had a quick question — are you happy with the leads your website is currently bringing in?\n\nIf not, I can do ${business.pitch.cta} for ${business.pitch.price}.${demoLine}\n\n— Matt\n(313) 992-1219`,
    };
  }

  const demoInstruction = demo
    ? `\n- MUST include this demo link naturally in the email: ${demo.url} — say something like "Here's one I built for a ${demo.label}" or "Check out what I did for a similar business: ${demo.url}"`
    : "";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      max_tokens: 400,
      system: `You write cold outreach emails for Matt Michels — Grosse Pointe, MI. B2B background, no-BS, Michigan local.

VOICE:
- Direct. No warmup. Say what you want.
- Short sentences. Sounds like a real text, not a marketing email.
- Never use "I hope this finds you well", "synergy", "leverage", "touch base"
- Casual but professional. Like a neighbor who's good at business.
- Exactly 4-6 sentences total. Never longer.

GOAL: Get a reply. Not sell them anything. Just get them curious enough to respond.`,
      messages: [{
        role: "user",
        content: `Write a cold email from Matt to ${business.business_name} (${business.industry || "local business"} in ${business.city || "Metro Detroit"}).

The pitch: ${business.pitch.cta} (${business.pitch.price}).

Rules:
- Opens with "Hey, my name's Matt Michels"
- References their specific business/industry naturally
- Pitches the product in one sentence, makes it sound easy${demoInstruction}
- Ends with "— Matt" and his phone number: (313) 992-1219
- Total: 4-6 sentences max

Return JSON: { "subject": "...", "body": "..." }
Subject should be under 45 chars, conversational, not salesy.`,
      }],
    }),
  });

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || raw);
  } catch {
    return {
      subject: `Quick question about ${business.business_name}`,
      body: `Hey, my name's Matt Michels — based in Grosse Pointe, I work with ${business.industry || "local"} businesses across the Detroit metro.\n\nSaw your listing and wanted to reach out — I can do ${business.pitch.cta} for ${business.pitch.price}.${demoLine}\n\n— Matt\n(313) 992-1219`,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json") ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dry_run === true;
    const limit = body?.limit || DAILY_SEND_LIMIT;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count how many we've already sent today
    const { count: sentToday } = await sb
      .from("prospect_outreach")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", today.toISOString());

    const remaining = Math.max(0, limit - (sentToday || 0));
    if (remaining === 0) {
      console.log("[NEO] Daily limit reached. Skipping.");
      return new Response(JSON.stringify({ sent: 0, reason: "daily_limit_reached" }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Find A-tier prospects not yet contacted
    const { data: prospects } = await sb
      .from("prospect_businesses")
      .select("id, business_name, email, industry, city, phone, has_website, rating, review_count, website")
      .eq("tier", "A")
      .eq("outreach_status", "new")
      .not("phone", "is", null)
      .order("review_count", { ascending: false })
      .limit(remaining);

    if (!prospects || prospects.length === 0) {
      console.log("[NEO] No A-tier prospects. Checking B-tier.");
      const { data: bProspects } = await sb
        .from("prospect_businesses")
        .select("id, business_name, email, industry, city, phone, has_website, rating, review_count, website")
        .eq("tier", "B")
        .eq("outreach_status", "new")
        .limit(Math.min(remaining, 5));

      if (!bProspects || bProspects.length === 0) {
        console.log("[NEO] No prospects to contact today.");
        return new Response(JSON.stringify({ sent: 0, reason: "no_prospects" }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    const allProspects = prospects || [];
    let sent = 0;
    const results: { business: string; email_sent_to: string; subject: string }[] = [];

    for (const prospect of allProspects) {
      if (sent >= remaining) break;
      if (!prospect.email) continue;

      // ── CAN-SPAM: skip suppressed emails ──
      if (TEST_EMAILS.includes(prospect.email.toLowerCase())) continue;
      if (await isEmailSuppressed(sb, prospect.email)) {
        console.log(`[NEO] Skipping suppressed email: ${prospect.business_name}`);
        await sb.from("prospect_businesses").update({ outreach_status: "suppressed" }).eq("id", prospect.id);
        continue;
      }

      const pitch = selectPitch(prospect);
      const { subject, body: emailBody } = await writePersonalizedEmail({
        business_name: prospect.business_name,
        industry: prospect.industry,
        city: prospect.city,
        phone: prospect.phone,
        pitch,
      });

      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1e293b;line-height:1.8;max-width:520px;">
        ${emailBody.split("\n").map(line => line ? `<p style="margin:0 0 12px;">${line}</p>` : "<br>").join("")}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
          <img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:10px;">
          <span style="font-size:13px;color:#64748b;">Matt Michels · Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219</span>
        </div>
      </div>`;

      if (!dryRun && RESEND_API_KEY) {
        const sendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@detroitwebagent.com>",
            reply_to: "matt@detroitwebagent.com",
            to: [prospect.email],
            bcc: ["matthewmichels4@gmail.com"],
            subject,
            html,
          }),
        });
        if (!sendRes.ok) {
          console.error(`[NEO] Failed to send to ${prospect.business_name}`);
          continue;
        }
      }

      if (!dryRun) {
        await sb.from("prospect_outreach").insert({
          prospect_id: prospect.id,
          email: prospect.email,
          business_name: prospect.business_name,
          industry: prospect.industry,
          outreach_type: "initial",
          subject,
          status: "sent",
        });
        await sb.from("prospect_businesses").update({ outreach_status: "contacted" }).eq("id", prospect.id);
      }

      results.push({ business: prospect.business_name, email_sent_to: prospect.email, subject });
      sent++;
      await new Promise(r => setTimeout(r, 200));
    }

    // ── FOLLOW-UPS ──
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    // Day-3 follow-up
    const { data: followUp1Needed } = await sb
      .from("prospect_outreach")
      .select("prospect_id, email, business_name, industry")
      .eq("outreach_type", "initial")
      .eq("status", "sent")
      .gte("sent_at", fourDaysAgo)
      .lt("sent_at", threeDaysAgo)
      .limit(5);

    for (const f of followUp1Needed || []) {
      if (sent >= remaining) break;
      if (await isEmailSuppressed(sb, f.email)) continue;

      // Check no follow_up_1 already sent
      const { count } = await sb.from("prospect_outreach").select("*", { count: "exact", head: true }).eq("prospect_id", f.prospect_id).eq("outreach_type", "follow_up_1");
      if ((count || 0) > 0) continue;

      const followSubject = `Re: ${f.business_name}`;
      const followHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1e293b;line-height:1.8;max-width:520px;">
        <p style="margin:0 0 12px;">Hey, just following up on my note from a few days ago.</p>
        <p style="margin:0 0 12px;">Still happy to take a look at ${f.business_name}'s web presence — takes me about 20 minutes and you'll know exactly what to fix.</p>
        <p style="margin:0 0 12px;">If the timing's off, no worries at all. Just reply and I'll leave you alone.</p>
        <p style="margin:0 0 12px;">— Matt<br>(313) 992-1219</p>
      </div>`;
      if (!dryRun && RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Matt Michels <matt@detroitwebagent.com>", reply_to: "matt@detroitwebagent.com", to: [f.email], bcc: ["matthewmichels4@gmail.com"], subject: followSubject, html: followHtml }),
        });
        await sb.from("prospect_outreach").insert({ prospect_id: f.prospect_id, email: f.email, business_name: f.business_name, outreach_type: "follow_up_1", subject: followSubject, status: "sent" });
      }
      sent++;
    }

    // Day-7 breakup email (Email 3 — casual last nudge)
    const { data: followUp2Needed } = await sb
      .from("prospect_outreach")
      .select("prospect_id, email, business_name, industry")
      .eq("outreach_type", "follow_up_1")
      .eq("status", "sent")
      .gte("sent_at", eightDaysAgo)
      .lt("sent_at", sevenDaysAgo)
      .limit(5);

    for (const f of followUp2Needed || []) {
      if (sent >= remaining) break;
      if (await isEmailSuppressed(sb, f.email)) continue;

      // Check no follow_up_2 already sent
      const { count } = await sb.from("prospect_outreach").select("*", { count: "exact", head: true }).eq("prospect_id", f.prospect_id).eq("outreach_type", "follow_up_2");
      if ((count || 0) > 0) continue;

      const classification = classifyIndustry(f.industry);
      let leadMagnetLine = "";
      if (classification === "subcontractor") {
        leadMagnetLine = `\n<p style="margin:0 0 12px;">Either way — we put together a free report showing open bids in your area. Might be useful even if we never work together: <a href="https://www.detroitwebagent.com/free-bid-report" style="color:#e8621a;">Free Bid Report</a></p>`;
      } else if (classification === "manufacturer") {
        leadMagnetLine = `\n<p style="margin:0 0 12px;">Either way — we run free compliance scans for manufacturers. Might save you a headache: <a href="https://www.detroitwebagent.com/free-compliance-scan" style="color:#e8621a;">Free Compliance Scan</a></p>`;
      }

      const breakupSubject = `closing the loop — ${f.business_name}`;
      const breakupHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1e293b;line-height:1.8;max-width:520px;">
        <p style="margin:0 0 12px;">Hey — just wanted to close the loop. I reached out a couple times about ${f.business_name}'s web presence.</p>
        <p style="margin:0 0 12px;">Totally get it if the timing's not right. I'll stop bugging you.</p>${leadMagnetLine}
        <p style="margin:0 0 12px;">If anything changes down the road, you've got my number.</p>
        <p style="margin:0 0 12px;">— Matt<br>(313) 992-1219</p>
      </div>`;

      if (!dryRun && RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Matt Michels <matt@detroitwebagent.com>", reply_to: "matt@detroitwebagent.com", to: [f.email], bcc: ["matthewmichels4@gmail.com"], subject: breakupSubject, html: breakupHtml }),
        });
        await sb.from("prospect_outreach").insert({ prospect_id: f.prospect_id, email: f.email, business_name: f.business_name, outreach_type: "follow_up_2", subject: breakupSubject, status: "sent" });
        // Mark prospect as fully sequenced
        await sb.from("prospect_businesses").update({ outreach_status: "sequenced" }).eq("id", f.prospect_id);
      }
      sent++;
    }

    console.log(`[NEO] Sent ${sent} emails (${dryRun ? "DRY RUN" : "LIVE"}). Prospects left: ${allProspects.length - sent}`);
    return new Response(JSON.stringify({ sent, dry_run: dryRun, results }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[NEO]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
