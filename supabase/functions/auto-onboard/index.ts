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
  reg_filing_monitor: {
    subject: "Welcome to Regulatory Filing Monitor — Quick Setup",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to your AI Regulatory Filing Monitor! To configure your alerts, I need:</p>
      <ul>
        <li><strong>NAICS codes</strong> — your primary codes (I can look these up if needed)</li>
        <li><strong>State</strong> — which state EPA portal to monitor</li>
        <li><strong>Phone number</strong> — for urgent SMS alerts when deadlines are within 30 days</li>
        <li><strong>Specific regulations</strong> — any you're already tracking that I should prioritize</li>
      </ul>
      <p>Your first scan is running now. You'll receive your first regulatory brief within 24 hours.</p>
      <p>Reply with those details and I'll configure everything!</p>`,
  },
  bid_intel_monitor: {
    subject: "Welcome to Bid Intelligence — Let's Find You Work",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Bid Intelligence & Proposal Factory! To start scanning for bids, I need:</p>
      <ul>
        <li><strong>Your trade(s)</strong> — electrical, mechanical, plumbing, concrete, etc.</li>
        <li><strong>Service territory</strong> — which cities/counties you'll bid on</li>
        <li><strong>Plan room logins</strong> — any specific plan rooms you already use (optional)</li>
        <li><strong>Historical pricing</strong> — a sample bid or rate sheet so the AI can draft proposals in your pricing range</li>
        <li><strong>Phone number</strong> — for SMS alerts when bids are due within 72 hours</li>
      </ul>
      <p>Your first bid scan is running now. You'll see matching opportunities within 24 hours.</p>
      <p>Reply with those details!</p>`,
  },
  commercial_lease_subscription: {
    subject: "Welcome to Commercial Lease Abstractor — Send Your Leases",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to the Commercial Lease Abstractor! To get started, I need:</p>
      <ul>
        <li><strong>Your commercial lease PDFs</strong> — email them as attachments or share a Drive/Dropbox link</li>
        <li><strong>Priority items</strong> — renewal dates, escalation clauses, anything you're specifically tracking</li>
      </ul>
      <p>First lease abstracts delivered within 48 hours of receiving your documents.</p>
      <p>Reply with your leases and I'll get to work!</p>`,
  },
  patent_watch_subscription: {
    subject: "Welcome to Patent Watch Intelligence — Let's Configure",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Patent Watch Intelligence! To start monitoring, I need:</p>
      <ul>
        <li><strong>Your industry/technology area</strong> — what patents matter to your business</li>
        <li><strong>Competitor names</strong> — companies whose patent activity you want tracked</li>
        <li><strong>Key terms/classifications</strong> — any specific patent classes or keywords</li>
      </ul>
      <p>Your first patent intelligence briefing arrives within 48 hours.</p>
      <p>Reply with those details!</p>`,
  },
  pe_intelligence_subscription: {
    subject: "Welcome to PE/Investor Intelligence — Quick Setup",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to PE & Investor Sector Intelligence! To configure your monitoring, I need:</p>
      <ul>
        <li><strong>Your sector(s)</strong> — which industries you're tracking deal flow in</li>
        <li><strong>Target deal size</strong> — what range matters to you</li>
        <li><strong>Geographic focus</strong> — specific regions or national</li>
      </ul>
      <p>First sector briefing arrives within 48 hours.</p>
      <p>Reply with your criteria!</p>`,
  },
  rd_intelligence_subscription: {
    subject: "Welcome to R&D Intelligence — Let's Set Up Your Feed",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Corporate R&D Paper Intelligence! To start monitoring, I need:</p>
      <ul>
        <li><strong>Research topics/keywords</strong> — what areas of R&D matter to you</li>
        <li><strong>Key institutions or companies</strong> — whose research output to prioritize</li>
        <li><strong>Industry context</strong> — how you'll use these insights</li>
      </ul>
      <p>First research briefing arrives within 48 hours.</p>
      <p>Reply with your topics!</p>`,
  },
  credit_dispute_subscription: {
    subject: "Welcome to Credit Dispute Letters — Send Your Reports",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to the Credit Dispute Letter Factory! To get started:</p>
      <ul>
        <li><strong>Pull your credit reports</strong> from annualcreditreport.com (all 3 bureaus)</li>
        <li><strong>Email them to me</strong> as PDFs or screenshots</li>
        <li><strong>Flag any specific items</strong> you know are incorrect</li>
      </ul>
      <p>First batch of dispute letters goes out within 48 hours of receiving your reports.</p>
      <p>Reply with your reports!</p>`,
  },
  medical_bill_subscription: {
    subject: "Welcome to Medical Bill Disputes — Send Your Bills",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Medical Bill Dispute Letters! To get started:</p>
      <ul>
        <li><strong>Send your medical bills</strong> — photos, PDFs, or screenshots</li>
        <li><strong>Include your EOB</strong> (Explanation of Benefits) if you have it</li>
        <li><strong>Note any charges</strong> that look wrong or confusing</li>
      </ul>
      <p>First dispute letters go out within 48 hours of receiving your bills.</p>
      <p>Reply with your bills!</p>`,
  },
  supplement_analyzer_subscription: {
    subject: "Welcome to Supplement Stack Analyzer — Send Your Stack",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to the Supplement Stack Analyzer! To get your first analysis:</p>
      <ul>
        <li><strong>List every supplement</strong> you're currently taking (name, brand, dosage)</li>
        <li><strong>Your goals</strong> — performance, longevity, sleep, focus, recovery, etc.</li>
        <li><strong>Any medications</strong> — so we can flag interactions</li>
      </ul>
      <p>First analysis delivered within 48 hours.</p>
      <p>Reply with your stack!</p>`,
  },
  trade_association_subscription: {
    subject: "Welcome to Trade Association Intelligence — Quick Setup",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Trade Association Intelligence! To configure your monitoring:</p>
      <ul>
        <li><strong>List your associations</strong> — national, state, and regional (e.g., NFIB, NAM, state chamber)</li>
        <li><strong>Your industry</strong> — so I can prioritize relevant regulations</li>
        <li><strong>Compliance deadlines</strong> — any you're already tracking</li>
      </ul>
      <p>First weekly digest arrives Monday.</p>
      <p>Reply with your associations!</p>`,
  },
  childrens_story_subscription: {
    subject: "Welcome — Your Child's First Story Arrives Sunday!",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to personalized bedtime stories! To make the stories perfect:</p>
      <ul>
        <li><strong>Child's name and age</strong> — already on file from signup</li>
        <li><strong>Favorite things</strong> — animals, characters, places, hobbies</li>
        <li><strong>Any themes to avoid</strong> — scary stuff, specific topics, etc.</li>
      </ul>
      <p>First story arrives this Sunday evening — ready for bedtime!</p>
      <p>Reply with any extra details you'd like included!</p>`,
  },
  luxury_re_subscription: {
    subject: "Welcome to Luxury Market Intelligence — Configuring Now",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name}!</p>
      <p>Welcome to Luxury Real Estate Intelligence! I'm configuring your market monitoring now. To dial it in:</p>
      <ul>
        <li><strong>Target zip codes</strong> — which luxury markets to monitor</li>
        <li><strong>Price floor</strong> — minimum price tier for "luxury" in your market</li>
        <li><strong>Property types</strong> — SFR, condos, waterfront, estates, etc.</li>
      </ul>
      <p>First weekly briefing arrives Monday.</p>
      <p>Reply with your market details!</p>`,
  },
  field_service_subscription: {
    subject: "Your Field Service App is Live — Click Here to Log In",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `<p>Hey ${name} — your dispatch board is live. Reply with your tech list and I'll have everything set up within 24 hours. — Matt</p>`,
  },
  hire_alert_subscription: {
    subject: "⚡ TechAlert is Live — Your Hiring Advantage Starts Tomorrow",
    nextStage: "📧 Welcome Email Sent",
    body: (name) => `
      <p>Hey ${name} —</p>
      <p>Welcome to TechAlert. Starting tomorrow at 7am, we scan <strong>three sources every single day</strong> and alert you before anyone else knows a licensed tech is available:</p>
      <p>🏛️ <strong>Michigan MIOSHA License Database</strong> — new license issued = new talent entering the market. No other tool monitors this.</p>
      <p>🔍 <strong>Apollo Professional Database</strong> — HVAC techs, plumbers, pipefitters, and electricians matched by location.</p>
      <p>📋 <strong>Job Board Monitoring</strong> — tradespeople actively posting their availability.</p>
      <p><strong>How alerts work:</strong></p>
      <p>🔥 <strong>Score 7-10:</strong> Instant SMS + email — act fast, these are hot<br>
      📋 <strong>Score 5-6:</strong> Daily email digest — worth keeping an eye on</p>
      <p>Each alert includes name, trade, city, license info, contact details (when available), and our AI availability score.</p>
      <p style="color:#64748b;font-size:13px;">Want to adjust your target roles or zip codes? Just reply to this email. — Matt</p>`,
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

function dwaEmail(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <img src="https://mattmichelstraining.com/images/dwa-coin.jpg" alt="Detroit Web Agency" width="90" height="90" style="display:block;margin:0 auto 14px;border-radius:50%;border:2px solid #00d4ff33" onerror="this.style.display='none'" />
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.8">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 806-4952</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="https://detroitwebagency.com" style="color:#00d4ff;text-decoration:none">detroitwebagency.com</a>&nbsp;·&nbsp;<a href="mailto:matt@mattmichelstraining.com?subject=Unsubscribe" style="color:#4a6fa5;text-decoration:none">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

function buildFieldServiceBody(
  name: string,
  company: string,
  magicLink: string,
  dispatchUrl: string,
  techAppUrl: string,
  plan: string
): string {
  const planLabel = plan === "bundle" ? "Website Bundle Plan" : "Standalone Plan";
  return `
    <p style="font-size:24px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.2">Your dispatch board is live, ${name}.</p>
    <p style="color:#4a6fa5;font-size:13px;margin:0 0 28px">${company} &nbsp;·&nbsp; ${planLabel}</p>

    <div style="background:#0d1f3c;border:1px solid #00d4ff33;border-radius:12px;padding:24px;margin:0 0 28px;text-align:center">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 6px">Click the button below to go straight to your account.</p>
      <p style="color:#4a6fa5;font-size:12px;margin:0 0 18px">No password needed — just click and you're in.</p>
      <a href="${magicLink}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:900;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">LOG INTO YOUR DISPATCH BOARD →</a>
      <p style="color:#4a6fa5;font-size:11px;margin:14px 0 0">This link is one-time use and expires in 24 hours. Need a new one? Just reply to this email.</p>
    </div>

    <div style="background:#0d1f3c;border-left:3px solid #00d4ff;padding:20px 24px;border-radius:0 8px 8px 0;margin:0 0 24px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 12px;letter-spacing:0.5px">WHAT DID YOU JUST SIGN UP FOR? (plain English)</p>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 10px">You signed up for Detroit Web Agency Field Service. Here's what that means in simple terms:</p>
      <p style="margin:0 0 10px"><span style="color:#00d4ff;font-weight:700">The Dispatch Board</span> <span style="color:#94a3b8;font-size:13px">is YOUR screen — you'll use it on a computer or phone. You can see all your jobs, assign them to your techs, and watch your crew in real time on a map. Think of it like a command center for your whole operation.</span></p>
      <p style="margin:0"><span style="color:#00d4ff;font-weight:700">The Tech App</span> <span style="color:#94a3b8;font-size:13px">is what your crew uses on their phones. They log in with a 4-digit PIN — no email, no password, nothing complicated. They see their jobs for the day, tap "On My Way" when they leave, snap a photo when they're done, and tap "Complete." That's it. Your guys can learn it in five minutes.</span></p>
    </div>

    <div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:24px;margin:0 0 24px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 16px;letter-spacing:0.5px">HERE'S WHAT TO DO FIRST:</p>
      <p style="margin:0 0 14px;color:#e2e8f0;font-size:14px"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:12px;padding:2px 8px;border-radius:4px;margin-right:10px">STEP 1</span><strong>Reply to this email</strong> with a list of your techs — just their name and cell number for each person. I'll add them to your account within a few hours.</p>
      <p style="margin:0 0 14px;color:#e2e8f0;font-size:14px"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:12px;padding:2px 8px;border-radius:4px;margin-right:10px">STEP 2</span><strong>Send your crew this link</strong> — this is the app they'll use on their phones:<br/><a href="${techAppUrl}" style="color:#00d4ff;font-size:12px;word-break:break-all">${techAppUrl}</a></p>
      <p style="margin:0;color:#e2e8f0;font-size:14px"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:12px;padding:2px 8px;border-radius:4px;margin-right:10px">STEP 3</span><strong>Send your customer list</strong> (even a messy spreadsheet or just a list of names is fine). I'll import them so you can start creating jobs right away.</p>
    </div>

    <div style="margin:0 0 24px">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px">Your personal dispatch board link (save this or bookmark it):</p>
      <a href="${dispatchUrl}" style="color:#00d4ff;font-size:12px;word-break:break-all">${dispatchUrl}</a>
    </div>

    <div style="border-top:1px solid #1e3a5f;padding-top:20px">
      <p style="color:#e2e8f0;font-size:14px;margin:0">— Matt Michels</p>
      <p style="color:#4a6fa5;font-size:12px;margin:5px 0 0">Detroit Web Agency &nbsp;·&nbsp; (313) 806-4952 &nbsp;·&nbsp; <a href="mailto:matt@detroitwebagent.com" style="color:#00d4ff;text-decoration:none">matt@detroitwebagent.com</a></p>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { service_type, client_email, business_name, company, plan, subscription_id } = await req.json();

    if (!service_type || !client_email) {
      return new Response(JSON.stringify({ error: "service_type and client_email required" }), { status: 400, headers: JSON_HEADERS });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const name = business_name || company || client_email.split("@")[0];

    // ── FIELD SERVICE: DWA-branded email with magic link ────────────────────
    if (service_type === "field_service_subscription") {
      // Look up the client record to get UUID and company name
      const { data: fsClient } = await sb
        .from("field_crm_clients")
        .select("id, plan, business_name")
        .eq("email", client_email)
        .maybeSingle();

      const clientId = fsClient?.id || "";
      const clientPlan = plan || fsClient?.plan || "standalone";
      const companyDisplay = fsClient?.business_name || company || name;
      const dispatchUrl = clientId
        ? `https://detroitwebagency.com/field-service/dispatch?client=${clientId}`
        : "https://detroitwebagency.com/field-service/dispatch";
      const techAppUrl = "https://detroitwebagency.com/field-service/tech";

      // Generate one-click magic link (passwordless login)
      let magicLink = dispatchUrl;
      try {
        const { data: linkData } = await sb.auth.admin.generateLink({
          type: "magiclink",
          email: client_email,
          options: { redirectTo: dispatchUrl },
        });
        if ((linkData as any)?.properties?.action_link) {
          magicLink = (linkData as any).properties.action_link;
        }
      } catch (e) {
        console.error("[auto-onboard] Magic link generation failed:", e);
      }

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
          to: [client_email],
          bcc: ["matthewmichels4@gmail.com"],
          subject: "Your Field Service App is Live — Click Here to Log In",
          html: dwaEmail(buildFieldServiceBody(name, companyDisplay, magicLink, dispatchUrl, techAppUrl, clientPlan)),
        }),
      });

      await Promise.all([
        subscription_id
          ? sb.from("service_subscriptions" as any)
              .update({ fulfillment_stage: "📧 Welcome Email Sent", updated_at: new Date().toISOString() })
              .eq("id", subscription_id)
          : Promise.resolve(),
        sb.from("notifications" as any).insert({
          type: "auto_onboard",
          title: `DWA Field Service welcome sent: ${companyDisplay}`,
          body: `Magic-link welcome email sent to ${client_email}. Dispatch: ${dispatchUrl}`,
          link: "/dwa-admin",
          urgency: "fyi",
          category: "onboarding",
        }),
      ]);

      return new Response(JSON.stringify({ sent: true, nextStage: "📧 Welcome Email Sent" }), { headers: JSON_HEADERS });
    }

    // ── ALL OTHER PRODUCTS ────────────────────────────────────────────────────
    const template = getTemplate(service_type);
    if (!template) {
      return new Response(JSON.stringify({ skipped: true, reason: "no template for service type" }), { headers: JSON_HEADERS });
    }

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
