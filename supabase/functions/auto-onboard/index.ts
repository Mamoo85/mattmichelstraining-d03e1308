// Auto-Onboard — sends welcome/onboarding email per product type
// Called from stripe-webhook after b2b_clients upsert for eligible products.
// Updates fulfillment_stage to next step after sending.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Email templates per product ─────────────────────────────────
interface OnboardTemplate {
  subject: string;
  nextStage: string;
  body: (name: string) => string;
}

const TEMPLATES: Record<string, OnboardTemplate> = {
  gbp_saas_subscription: {
    subject: "Welcome to GBP Automation — Quick Setup Required",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your Google Business Profile automation service. To get started, I need you to <strong>add me as a manager</strong> on your Google Business Profile.</p>
      <p><strong>Here's how:</strong></p>
      <ol>
        <li>Go to <a href="https://business.google.com">business.google.com</a></li>
        <li>Click your business → Users → Add user</li>
        <li>Enter: <strong>matt@mattmichelstraining.com</strong></li>
        <li>Set role to <strong>Manager</strong></li>
      </ol>
      <p>Once you add me, I'll start creating and scheduling AI-powered posts 3x per week. You'll see the first post within 48 hours of being added.</p>
      <p>Reply to this email if you have any questions!</p>`,
  },
  missed_call_subscription: {
    subject: "Welcome to Missed Call Text-Back — One Quick Question",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Missed Call Text-Back! To activate your service, I just need <strong>one thing</strong>:</p>
      <p><strong>What phone number should I monitor for missed calls?</strong></p>
      <p>Just reply to this email with the number and I'll have everything set up within 24 hours. After that, every missed call automatically gets a friendly text-back so you never lose a lead.</p>
      <p>Talk soon!</p>`,
  },
  social_media_subscription: {
    subject: "Welcome to Social Media AI — Let's Connect Your Accounts",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your AI Social Media service! To start posting, I need access to your social accounts.</p>
      <p><strong>Please reply with:</strong></p>
      <ul>
        <li>Your Facebook Business Page name/URL</li>
        <li>Your Instagram handle (if applicable)</li>
        <li>Your LinkedIn company page URL (if applicable)</li>
        <li>Any brand guidelines, tone preferences, or topics to focus on</li>
      </ul>
      <p>Once I have these, your first AI-generated posts will go live within 48 hours — 3x per week on each platform.</p>
      <p>Reply anytime!</p>`,
  },
  web_design: {
    subject: "Welcome — Let's Build Your Website!",
    nextStage: "📧 Intake Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Exciting! I'm ready to build your new website. To get started, I need a few things from you:</p>
      <ul>
        <li><strong>Logo</strong> — any format (PNG, SVG, etc.)</li>
        <li><strong>Brand colors</strong> — if you have preferences</li>
        <li><strong>Content</strong> — a rough outline of pages/sections you want</li>
        <li><strong>Photos</strong> — any images you'd like on the site</li>
        <li><strong>Domain</strong> — do you already own a domain name?</li>
        <li><strong>Inspiration</strong> — any websites you like the look of?</li>
      </ul>
      <p>Don't worry if you don't have all of this yet — just reply with what you have and we'll figure out the rest together.</p>`,
  },
  contractor_leads: {
    subject: "Welcome to Contractor Lead Gen — Here's What to Expect",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your exclusive lead generation service! Here's what happens next:</p>
      <ol>
        <li>I'm setting up your dedicated lead capture page now</li>
        <li>You'll start receiving exclusive leads within 3-5 business days</li>
        <li>Each lead comes with name, phone, email, and job details</li>
        <li>Leads are sent to you via email + text in real-time</li>
      </ol>
      <p><strong>Quick question:</strong> What's the best phone number to text leads to? And what's your primary service area (city/zip)?</p>
      <p>Reply anytime and I'll get everything configured!</p>`,
  },
  storm_lead_subscription: {
    subject: "Welcome to Storm Damage Leads — You're All Set!",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Storm Damage Lead Blaster! Here's how it works:</p>
      <ul>
        <li>I monitor NOAA weather alerts for your zip codes 24/7</li>
        <li>When severe weather hits your area, you get an instant SMS alert</li>
        <li>You'll be the first contractor calling homeowners after a storm</li>
      </ul>
      <p><strong>Quick question:</strong> What zip codes do you want me to monitor? And what's your trade (roofing, siding, etc.)?</p>
      <p>Reply with those details and I'll activate your alerts immediately!</p>`,
  },
  recall_alert_subscription: {
    subject: "Welcome to Recall Alerts — Daily Monitoring Active",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your FDA & CPSC Recall Alert service! Starting tomorrow, you'll receive:</p>
      <ul>
        <li>Daily AI-summarized recall alerts from FDA and CPSC</li>
        <li>Only recalls relevant to your industry</li>
        <li>Plain-English summaries — no legal jargon</li>
      </ul>
      <p><strong>Quick question:</strong> What industry are you in, and what product categories should I watch? (e.g., food service, childcare, automotive parts)</p>
      <p>Reply and I'll configure your filters!</p>`,
  },
  permit_watch_subscription: {
    subject: "Welcome to Permit Watch — Scanning Starts Tomorrow",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Permit Watch! Here's what you'll get:</p>
      <ul>
        <li>Daily scans of building permits filed in your area</li>
        <li>Matched to your trades so you only see relevant permits</li>
        <li>Early intel on new construction = first to reach the homeowner</li>
      </ul>
      <p><strong>Quick question:</strong> What city/area should I monitor, and what trades do you cover? (e.g., plumbing, electrical, HVAC)</p>
      <p>Reply and I'll start scanning!</p>`,
  },
  speed_audit_subscription: {
    subject: "Welcome to Website Speed Audits — First Report Coming Soon",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your monthly Website Speed Audit service! Here's what to expect:</p>
      <ul>
        <li>Monthly mobile + desktop performance reports</li>
        <li>AI-written plain-English recommendations</li>
        <li>Google PageSpeed scores with actionable fixes</li>
      </ul>
      <p>Your first report will arrive within 48 hours. No setup needed — I already have your website URL from checkout.</p>
      <p>Reply if you have any questions!</p>`,
  },
  bedtime_story_subscription: {
    subject: "Welcome to AI Bedtime Stories — Tonight's Story Awaits! ✨",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to AI Bedtime Stories! Every evening at 7 PM, your child will receive a brand-new, personalized bedtime story.</p>
      <ul>
        <li>Your child is the <strong>hero</strong> of every story</li>
        <li>Stories are tailored to their age and interests</li>
        <li>Each story has a gentle moral and happy ending</li>
      </ul>
      <p>The first story arrives tonight! If you'd like to update your child's interests or details, just reply to this email.</p>`,
  },
  crime_digest_subscription: {
    subject: "Welcome to Neighborhood Crime Digest — Weekly Reports Starting",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your weekly Neighborhood Crime Digest! Every Monday morning, you'll receive:</p>
      <ul>
        <li>AI-summarized crime reports for your zip code</li>
        <li>Trend analysis (up/down vs. last week)</li>
        <li>Safety recommendations for your area</li>
      </ul>
      <p>Your first report arrives next Monday. No setup needed — I have your zip code from checkout.</p>
      <p>Reply if you have questions!</p>`,
  },
  license_monitor_subscription: {
    subject: "Welcome to License Monitor — Never Miss a Renewal",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Business License Expiry Monitor! To set up your reminders, I need:</p>
      <ul>
        <li><strong>License name</strong> (e.g., Contractor License, Business Registration)</li>
        <li><strong>License number</strong> (optional)</li>
        <li><strong>Expiry date</strong></li>
        <li><strong>Issuing body</strong> (e.g., State of Michigan, City of Detroit)</li>
      </ul>
      <p>You'll get reminders at 90, 60, 30, 14, and 7 days before expiry — so you never miss a deadline.</p>
      <p>Reply with your license details and I'll set everything up!</p>`,
  },
};

// Generic SMS product template
const SMS_PRODUCT_TEMPLATE: OnboardTemplate = {
  subject: "Welcome — Quick Setup for Your SMS Service",
  nextStage: "📧 Welcome Email Sent",
  body: (name) => `
    <p>Hey ${name}!</p>
    <p>Welcome to your new SMS service! To get started, I need:</p>
    <ul>
      <li><strong>Your business phone number</strong> (for caller ID)</li>
      <li><strong>A list of customer phone numbers</strong> you'd like to reach (CSV or just list them)</li>
    </ul>
    <p>Reply with these details and I'll have your service running within 24 hours.</p>`,
};

const SMS_TYPES = new Set([
  "sms_blast", "noshow_rebooker", "estimate_followup", "invoice_chaser",
  "afterjob_drip", "promo_blaster", "referral_program", "slow_day_sms",
  "homeowner_campaign", "review_monitor",
]);

function getTemplate(serviceType: string): OnboardTemplate | null {
  if (TEMPLATES[serviceType]) return TEMPLATES[serviceType];
  if (SMS_TYPES.has(serviceType)) return SMS_PRODUCT_TEMPLATE;
  return null;
}

function m2Email(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#1e293b;padding:20px 28px">
    <h1 style="margin:0;color:#e8621a;font-size:18px;font-weight:800">M² Development</h1>
  </div>
  <div style="padding:24px 28px;color:#334155;font-size:14px;line-height:1.7">${bodyHtml}
    <p style="margin-top:20px">Best,<br><strong>Matt Michels</strong><br><span style="color:#94a3b8;font-size:12px">M² Development · (313) 806-4952</span></p>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · Grosse Pointe, MI 48230</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:10px"><a href="https://mattmichelstraining.com" style="color:#94a3b8">mattmichelstraining.com</a> · <a href="mailto:matt@mattmichelstraining.com?subject=Unsubscribe" style="color:#94a3b8">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { service_type, client_email, business_name, subscription_id } = await req.json();

    if (!service_type || !client_email) {
      return new Response(JSON.stringify({ error: "service_type and client_email required" }), { status: 400, headers: JSON_HEADERS });
    }

    const template = getTemplate(service_type);
    if (!template) {
      return new Response(JSON.stringify({ skipped: true, reason: "no template for service type" }), { headers: JSON_HEADERS });
    }

    const name = business_name || client_email.split("@")[0];

    // Send onboarding email
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [client_email],
        bcc: ["matthewmichels4@gmail.com"],
        subject: template.subject,
        html: m2Email(template.body(name)),
      }),
    });

    // Update fulfillment_stage
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    if (subscription_id) {
      await sb.from("service_subscriptions" as any)
        .update({ fulfillment_stage: template.nextStage, updated_at: new Date().toISOString() })
        .eq("id", subscription_id);
    }

    // Insert notification for Matt
    await sb.from("notifications" as any).insert({
      type: "auto_onboard",
      title: `Auto-onboard email sent: ${name}`,
      body: `Welcome email sent to ${client_email} for ${service_type}. Stage → ${template.nextStage}`,
      link: "/admin#fulfillment",
      urgency: "fyi",
      category: "onboarding",
    });

    return new Response(JSON.stringify({ sent: true, nextStage: template.nextStage }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("[auto-onboard] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
