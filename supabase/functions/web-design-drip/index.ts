import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[WEB-DESIGN-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Industry → landing page map (mirrors prospect-local-businesses) ──
const INDUSTRY_PAGE_MAP: Record<string, { path: string; price: string; monthly: string }> = {
  "dental practice":        { path: "/dental-web-design",     price: "$1,499", monthly: "$99/mo" },
  "dentist":                { path: "/dental-web-design",     price: "$1,499", monthly: "$99/mo" },
  "orthodontist":           { path: "/dental-web-design",     price: "$1,499", monthly: "$99/mo" },
  "law firm":               { path: "/legal-web-design",      price: "$1,499", monthly: "$99/mo" },
  "attorney":               { path: "/legal-web-design",      price: "$1,499", monthly: "$99/mo" },
  "personal injury attorney": { path: "/legal-web-design",   price: "$1,499", monthly: "$99/mo" },
  "physical therapy clinic":{ path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "chiropractic office":    { path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "urgent care clinic":     { path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "accounting firm":        { path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "insurance agency":       { path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "veterinary clinic":      { path: "/healthcare-web-design", price: "$1,499", monthly: "$99/mo" },
  "restaurant":             { path: "/restaurant-web-design", price: "$799",   monthly: "$79/mo" },
  "bar and grill":          { path: "/restaurant-web-design", price: "$799",   monthly: "$79/mo" },
  "pizza restaurant":       { path: "/restaurant-web-design", price: "$799",   monthly: "$79/mo" },
  "manufacturing company":  { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "machine shop":           { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "fabrication shop":       { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "metal fabrication shop": { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "plastic injection molding company": { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "industrial equipment dealer": { path: "/manufacturing-web-design", price: "$1,499", monthly: "$99/mo" },
  "commercial real estate broker": { path: "/real-estate-web-design", price: "$1,499", monthly: "$99/mo" },
  "real estate agent":      { path: "/real-estate-web-design", price: "$1,499", monthly: "$99/mo" },
  "mortgage broker":        { path: "/real-estate-web-design", price: "$1,499", monthly: "$99/mo" },
};
const DEFAULT_PAGE = { path: "/detroit-web-design", price: "$499", monthly: "$49/mo" };

function getIndustryPage(industry: string): { path: string; price: string; monthly: string } {
  const lower = industry.toLowerCase();
  for (const [key, val] of Object.entries(INDUSTRY_PAGE_MAP)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return DEFAULT_PAGE;
}

const DRIP_SEQUENCE = [
  {
    templateName: "web_drip_d1",
    daysAfterPrev: 0, // Send immediately
    subject: (biz: string, industry: string) => `${biz} — your competitors are getting calls you're not`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —

I was looking up ${industry.toLowerCase()} businesses in your area and noticed ${biz} doesn't have a website pulling in leads.

I build sites for local businesses — ${page.price} flat, professional design, no agency markup. Just a site that ranks on Google and makes your phone ring.

Want to see what I'd build for you? Check out what I've done: ${siteUrl}

Start here: mattmichelstraining.com/get-started — I'll reach out the same day.

— Matt Michels, Grosse Pointe
(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d3",
    daysAfterPrev: 3,
    subject: (biz: string, industry: string) => `Quick follow-up for ${biz}`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —

Circling back from a few days ago. I build websites specifically for ${industry.toLowerCase()} businesses — here's what you get:

- Ranked on Google for "${industry.toLowerCase()} + your city"
- Click-to-call button front and center
- Contact form that actually gets filled out
- ${page.price} flat. ${page.monthly} after. No contract.

See examples: ${siteUrl}

If the timing's not right, no hard feelings. But if you're tired of watching competitors get the calls you should be getting — let's talk.

— Matt
(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d7",
    daysAfterPrev: 4,
    subject: (biz: string, industry: string) => `I ran a quick check on ${biz}'s online presence`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —

I did a quick audit of ${biz}'s online presence. Here's what I found:

→ Google ranking for "${industry.toLowerCase()} [your area]": Not in top 10
→ Website: Missing or not converting
→ Google Business Profile: Needs optimization
→ Opportunity: HIGH

This is fixable. ${page.price} to build. ${page.monthly} to run. That's it.

I'm a local business owner in Grosse Pointe — you get my direct cell, not a support ticket.

See what I've built for ${industry.toLowerCase()} businesses: ${siteUrl}

— Matt
(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d14",
    daysAfterPrev: 7,
    subject: (biz: string, industry: string) => `Last message from me, ${biz}`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —

Last email, I promise.

I've reached out a few times about building a website for ${biz}. If the timing's off or you're not interested — completely understood, no hard feelings.

But if you ever want a professional site built specifically for ${industry.toLowerCase()} businesses — ${page.price} flat, ${page.monthly} after — reach out anytime.

See what I've built: ${siteUrl}

— Matt Michels, Grosse Pointe
(313) 806-4952`;
    },
  },
];

function buildDripEmailHtml(subject: string, body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>").replace(/→/g, "→");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#0f172a;padding:3px 0;"></td></tr>
    <tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.8;">
      ${htmlBody}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-family-cornfield.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
        <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Prefer to just text? (313) 806-4952</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
      Matt Michels Web Design · Grosse Pointe, MI · (313) 806-4952<br>
      <a href="https://www.mattmichelstraining.com/detroit-web-design" style="color:#94a3b8;">See my work</a>
    </td></tr>
  </table>
</td></tr>
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow both admin-triggered and service-role (cron) calls
    const authHeader = req.headers.get("Authorization");
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Find all auto-prospected leads that have an email and are in "new" status
    const { data: leads, error: leadsErr } = await serviceClient
      .from("web_design_leads" as any)
      .select("id, name, business, email, description, created_at, notes")
      .eq("status", "new")
      .not("email", "eq", "")
      .not("email", "is", null)
      .ilike("description", "%auto_prospected%");

    if (leadsErr) throw new Error(leadsErr.message || JSON.stringify(leadsErr));
    if (!leads || leads.length === 0) {
      log("No drip-eligible leads found");
      return new Response(JSON.stringify({ sent: 0, message: "No drip-eligible leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Found drip-eligible leads", { count: leads.length });
    let sent = 0;

    for (const lead of leads) {
      try {
        const leadId = lead.id;
        const email: string = lead.email;
        const business: string = lead.business || "your business";

        // Extract industry from description
        const industryMatch = lead.description?.match(/INDUSTRY: ([^|]+)/);
        const industry = industryMatch?.[1]?.trim() || "contractor";

        // Find which drip step to send next
        const { data: sentLogs } = await serviceClient
          .from("email_send_log" as any)
          .select("template_name, created_at")
          .eq("recipient_email", email)
          .like("template_name", "web_drip_%")
          .order("created_at", { ascending: false });

        const sentTemplates = new Set((sentLogs || []).map((l: any) => l.template_name));
        const lastSent = sentLogs?.[0];
        const daysSinceLastSent = lastSent
          ? (Date.now() - new Date(lastSent.created_at).getTime()) / 86400000
          : 999;

        // Find next unsent step
        let nextStep = null;
        for (const step of DRIP_SEQUENCE) {
          if (!sentTemplates.has(step.templateName)) {
            // Check timing
            if (step.daysAfterPrev === 0 || daysSinceLastSent >= step.daysAfterPrev) {
              nextStep = step;
              break;
            }
          }
        }

        if (!nextStep) {
          log("Lead drip complete or not due", { leadId, email });
          continue;
        }

        // Check suppression list
        const { data: suppressed } = await serviceClient
          .from("suppressed_emails" as any)
          .select("email")
          .eq("email", email.toLowerCase())
          .limit(1);

        if (suppressed && suppressed.length > 0) {
          log("Email suppressed", { email });
          continue;
        }

        const subject = nextStep.subject(business, industry);
        const body = nextStep.body(business, industry);
        const html = buildDripEmailHtml(subject, body);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [email], bcc: ["matthewmichels4@gmail.com"],
            subject,
            html,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          log("Send failed", { email, error: errText });
          continue;
        }

        // Log the send
        await serviceClient.from("email_send_log" as any).insert({
          recipient_email: email,
          template_name: nextStep.templateName,
          status: "sent",
          message_id: `drip_${leadId}_${nextStep.templateName}`,
        });

        sent++;
        log("Drip email sent", { email, step: nextStep.templateName, business });

        // Small delay between sends
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        log("Error processing lead", { error: String(err), leadId: lead.id });
      }
    }

    return new Response(
      JSON.stringify({ sent, total: leads.length, message: `Drip run complete. ${sent} emails sent.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
