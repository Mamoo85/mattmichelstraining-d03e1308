import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[WEB-DESIGN-DRIP] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

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
  "real estate agent":      { path: "/real-estate-web-design", price: "$1,499", monthly: "$99/mo" },
  "mortgage broker":        { path: "/real-estate-web-design", price: "$1,499", monthly: "$99/mo" },
  "roofer":                 { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "roofing":                { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "plumber":                { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "electrician":            { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "hvac":                   { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "landscaper":             { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "contractor":             { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "deck builder":           { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
  "auto repair":            { path: "/detroit-web-design",     price: "$499",   monthly: "$49/mo" },
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
    daysAfterPrev: 0,
    subject: (biz: string, industry: string) => `${biz} — your competitors are getting calls you're not`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —\n\nI was looking up ${industry.toLowerCase()} businesses in your area and noticed ${biz} doesn't have a website pulling in leads.\n\nI build sites for local businesses — ${page.price} flat, professional design, no agency markup. Just a site that ranks on Google and makes your phone ring.\n\nWant to see what I'd build for you? Check out what I've done: ${siteUrl}\n\nStart here: mattmichelstraining.com/get-started — I'll reach out the same day.\n\n— Matt Michels, Grosse Pointe\n(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d4",
    daysAfterPrev: 3,
    subject: (biz: string, industry: string) => `Quick follow-up for ${biz}`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —\n\nCircling back from a few days ago. I build websites specifically for ${industry.toLowerCase()} businesses — here's what you get:\n\n- Ranked on Google for "${industry.toLowerCase()} + your city"\n- Click-to-call button front and center\n- Contact form that actually gets filled out\n- ${page.price} flat. ${page.monthly} after. No contract.\n\nSee examples: ${siteUrl}\n\nIf the timing's not right, no hard feelings. But if you're tired of watching competitors get the calls you should be getting — let's talk.\n\n— Matt\n(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d8",
    daysAfterPrev: 4,
    subject: (biz: string, industry: string) => `I ran a quick check on ${biz}'s online presence`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —\n\nI did a quick audit of ${biz}'s online presence. Here's what I found:\n\n→ Google ranking for "${industry.toLowerCase()} [your area]": Not in top 10\n→ Website: Missing or not converting\n→ Google Business Profile: Needs optimization\n→ Opportunity: HIGH\n\nThis is fixable. ${page.price} to build. ${page.monthly} to run. That's it.\n\nI'm a local business owner in Grosse Pointe — you get my direct cell, not a support ticket.\n\nSee what I've built for ${industry.toLowerCase()} businesses: ${siteUrl}\n\n— Matt\n(313) 806-4952`;
    },
  },
  {
    templateName: "web_drip_d15",
    daysAfterPrev: 7,
    subject: (biz: string, industry: string) => `Last message from me, ${biz}`,
    body: (biz: string, industry: string) => {
      const page = getIndustryPage(industry);
      const siteUrl = `mattmichelstraining.com${page.path}`;
      return `Hey —\n\nLast email, I promise.\n\nI've reached out a few times about building a website for ${biz}. If the timing's off or you're not interested — completely understood, no hard feelings.\n\nBut if you ever want a professional site built specifically for ${industry.toLowerCase()} businesses — ${page.price} flat, ${page.monthly} after — reach out anytime.\n\nSee what I've built: ${siteUrl}\n\n— Matt Michels, Grosse Pointe\n(313) 806-4952`;
    },
  },
];

function buildDripEmailHtml(subject: string, body: string): string {
  const htmlBody = body.replace(/\n/g, "<br>");
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
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels"></td>
          <td style="padding-left:12px;font-size:13px;color:#334155;vertical-align:middle;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</td>
        </tr></table>
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
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Check if a specific lead ID was passed (one-click send)
    let body: any = {};
    try { body = await req.json(); } catch {}
    const singleLeadId = body?.leadId;

    // Query outreach_leads (the ACTUAL table with prospected leads)
    let query = sb
      .from("outreach_leads")
      .select("id, business_name, email, industry, city, status, lead_score, ai_drafted_subject, ai_drafted_pitch, notes")
      .not("email", "is", null)
      .neq("email", "");

    if (singleLeadId) {
      query = query.eq("id", singleLeadId);
    } else {
      query = query.eq("status", "new");
    }

    const { data: leads, error: leadsErr } = await query;

    if (leadsErr) throw new Error(leadsErr.message || JSON.stringify(leadsErr));
    if (!leads || leads.length === 0) {
      log("No drip-eligible leads found");
      return new Response(JSON.stringify({ sent: 0, total: 0, message: "No drip-eligible leads" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Found drip-eligible leads", { count: leads.length });
    let sent = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        const email: string = lead.email;
        const business: string = lead.business_name || "your business";
        const industry: string = lead.industry || "contractor";

        // Check suppression
        const { data: suppressed } = await sb
          .from("suppressed_emails")
          .select("email")
          .eq("email", email.toLowerCase())
          .limit(1);

        if (suppressed && suppressed.length > 0) {
          log("Email suppressed", { email });
          continue;
        }

        // Find which drip step to send next
        const { data: sentLogs } = await sb
          .from("email_send_log")
          .select("template_name, created_at")
          .eq("recipient_email", email)
          .like("template_name", "web_drip_%")
          .order("created_at", { ascending: false });

        const sentTemplates = new Set((sentLogs || []).map((l: any) => l.template_name));
        const lastSent = sentLogs?.[0];
        const daysSinceLastSent = lastSent
          ? (Date.now() - new Date(lastSent.created_at).getTime()) / 86400000
          : 999;

        let nextStep = null;
        for (const step of DRIP_SEQUENCE) {
          if (!sentTemplates.has(step.templateName)) {
            if (step.daysAfterPrev === 0 || daysSinceLastSent >= step.daysAfterPrev) {
              nextStep = step;
              break;
            }
          }
        }

        if (!nextStep) {
          log("Lead drip complete or not due", { email });
          continue;
        }

        const subject = nextStep.subject(business, industry);
        const bodyText = nextStep.body(business, industry);
        const html = buildDripEmailHtml(subject, bodyText);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [email],
            bcc: ["matthewmichels4@gmail.com"],
            subject,
            html,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          log("Send failed", { email, error: errText });
          errors.push(`${email}: ${errText}`);
          continue;
        }
        await res.json();

        await sb.from("email_send_log").insert({
          recipient_email: email,
          template_name: nextStep.templateName,
          status: "sent",
          message_id: `drip_${lead.id}_${nextStep.templateName}`,
        });

        // Update lead status
        await sb.from("outreach_leads").update({
          status: "Emailed",
          last_contact_date: new Date().toISOString().split("T")[0],
        }).eq("id", lead.id);

        sent++;
        log("Drip email sent", { email, step: nextStep.templateName, business });

        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        log("Error processing lead", { error: String(err), leadId: lead.id });
        errors.push(`${lead.id}: ${String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, total: leads.length, errors: errors.length, message: `Drip run complete. ${sent} emails sent.` }),
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
