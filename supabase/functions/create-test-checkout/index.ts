// CREATE TEST CHECKOUT — Admin Only
// Creates a real $0 Stripe checkout for any product so Matt can test the full
// purchase flow: checkout → webhook → delivery → email. Everything fires for real.
// Only works for Matt's email addresses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const MATT_EMAILS = ["matt@mattmichelstraining.com", "matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

const MATT = "matt@mattmichelstraining.com";
const SITE = "https://www.mattmichelstraining.com";

interface ProductConfig {
  name: string;
  description: string;
  mode: "payment" | "subscription";
  metadata: Record<string, string>;
  success_url: string;
}

const TEST_PRODUCTS: Record<string, ProductConfig> = {
  // ── INSTANT DELIVERY PRODUCTS ──────────────────────────────────────────────
  website_audit: {
    name: "TEST — AI Website Audit",
    description: "Full website audit delivered to your inbox within minutes.",
    mode: "payment",
    metadata: {
      type: "website_audit",
      email: MATT,
      business_name: "M² Performance Training",
      business_url: "mattmichelstraining.com",
      is_test: "true",
    },
    success_url: `${SITE}/audit-report?test=true`,
  },
  gbp_post_pack: {
    name: "TEST — GBP Post Pack",
    description: "30 Google Business Profile posts delivered to your inbox.",
    mode: "payment",
    metadata: {
      type: "gbp_post_pack",
      email: MATT,
      business_name: "M² Performance Training",
      business_info: JSON.stringify({ industry: "fitness training", city: "Grosse Pointe", business_info: "Performance training for athletes and families" }),
      is_test: "true",
    },
    success_url: `${SITE}/gbp-management?test=true`,
  },
  competitor_report: {
    name: "TEST — AI Competitor Report",
    description: "Full competitor analysis for your market.",
    mode: "payment",
    metadata: {
      type: "competitor_report",
      email: MATT,
      business_name: "M² Performance Training",
      industry: "fitness training",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/audit-report?test=true`,
  },

  // ── SUBSCRIPTION PRODUCTS ──────────────────────────────────────────────────
  gbp_saas_subscription: {
    name: "TEST — GBP SaaS ($49/mo)",
    description: "AI posts 3x/week to Google Business Profile. $0 test.",
    mode: "subscription",
    metadata: {
      type: "gbp_saas_subscription",
      email: MATT,
      plan: "basic",
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/local-marketing?test=true`,
  },
  social_media_subscription: {
    name: "TEST — Social Media AI ($199/mo)",
    description: "3 posts/week to Facebook, Instagram, LinkedIn. $0 test.",
    mode: "subscription",
    metadata: {
      type: "social_media_subscription",
      email: MATT,
      plan: "standard",
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/social-media-ai?test=true`,
  },
  field_rep_subscription: {
    name: "TEST — Field Rep Tools ($29/mo)",
    description: "4 AI sales tools for field reps. $0 test.",
    mode: "subscription",
    metadata: {
      type: "field_rep_subscription",
      email: MATT,
      is_test: "true",
    },
    success_url: `${SITE}/field-rep-tools?test=true`,
  },
  contractor_lead_subscription: {
    name: "TEST — Contractor Leads ($399/mo)",
    description: "Exclusive local contractor leads. $0 test.",
    mode: "subscription",
    metadata: {
      type: "contractor_lead_subscription",
      email: MATT,
      businessName: "M² Test Roofing",
      trade: "roofing",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/contractor-leads?test=true`,
  },
  b2b_database_subscription: {
    name: "TEST — B2B Database ($49/mo)",
    description: "Michigan dental office contacts database. $0 test.",
    mode: "subscription",
    metadata: {
      type: "b2b_database_subscription",
      email: MATT,
      niche: "dental",
      is_test: "true",
    },
    success_url: `${SITE}/b2b-leads?test=true`,
  },
  review_responder_subscription: {
    name: "TEST — Review Responder",
    description: "AI responds to Google reviews automatically. $0 test.",
    mode: "subscription",
    metadata: {
      type: "review_responder_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/review-responder?test=true`,
  },
  seo_report_subscription: {
    name: "TEST — SEO Reports",
    description: "Monthly SEO audit reports. $0 test.",
    mode: "subscription",
    metadata: {
      type: "seo_report_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      website: "mattmichelstraining.com",
      is_test: "true",
    },
    success_url: `${SITE}/seo-reports?test=true`,
  },
  chatbot_subscription: {
    name: "TEST — AI Chatbot",
    description: "AI chatbot for contractor websites. $0 test.",
    mode: "subscription",
    metadata: {
      type: "chatbot_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/contractor-chatbot?test=true`,
  },
  missed_call_subscription: {
    name: "TEST — Missed Call Text",
    description: "Auto-texts back missed calls. $0 test.",
    mode: "subscription",
    metadata: {
      type: "missed_call_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/missed-call-text?test=true`,
  },

  // ── 10 NEW SMS / MONITORING PRODUCTS ──────────────────────────────────────
  review_monitor_subscription: {
    name: "TEST — Review Monitor ($25/mo)",
    description: "Instant SMS alert + AI response when a Google review comes in. $0 test.",
    mode: "subscription",
    metadata: {
      type: "review_monitor_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      is_test: "true",
    },
    success_url: `${SITE}/review-monitor?test=true`,
  },
  sms_blast_subscription: {
    name: "TEST — Weekly SMS Blast ($19/mo)",
    description: "AI-written weekly text to your entire customer list every Tuesday. $0 test.",
    mode: "subscription",
    metadata: {
      type: "sms_blast_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/weekly-sms-blast?test=true`,
  },
  noshow_subscription: {
    name: "TEST — No-Show Re-Booker ($25/mo)",
    description: "Auto-texts no-shows 30 minutes after they miss an appointment. $0 test.",
    mode: "subscription",
    metadata: {
      type: "noshow_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      booking_url: "https://www.mattmichelstraining.com/schedule",
      is_test: "true",
    },
    success_url: `${SITE}/no-show-rebooker?test=true`,
  },
  estimate_drip_subscription: {
    name: "TEST — Estimate Follow-Up Drip ($39/mo)",
    description: "5-text sequence over 14 days after every quote you give. $0 test.",
    mode: "subscription",
    metadata: {
      type: "estimate_drip_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      is_test: "true",
    },
    success_url: `${SITE}/estimate-followup?test=true`,
  },
  invoice_chaser_subscription: {
    name: "TEST — Invoice Chaser ($29/mo)",
    description: "Automated Day 7/14/21 text reminders for unpaid invoices. $0 test.",
    mode: "subscription",
    metadata: {
      type: "invoice_chaser_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      is_test: "true",
    },
    success_url: `${SITE}/invoice-chaser?test=true`,
  },
  afterjob_drip_subscription: {
    name: "TEST — After-Job Drip ($29/mo)",
    description: "3-touch sequence after every job: thank you, review ask, 30-day upsell. $0 test.",
    mode: "subscription",
    metadata: {
      type: "afterjob_drip_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      is_test: "true",
    },
    success_url: `${SITE}/after-job-followup?test=true`,
  },
  promo_blaster_subscription: {
    name: "TEST — Seasonal Promo Blaster ($29/mo)",
    description: "6 AI-written seasonal SMS campaigns auto-sent per year. $0 test.",
    mode: "subscription",
    metadata: {
      type: "promo_blaster_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/seasonal-promos?test=true`,
  },
  referral_program_subscription: {
    name: "TEST — Referral Program ($39/mo)",
    description: "Automated referral tracking, thank-you texts, monthly top-referrer report. $0 test.",
    mode: "subscription",
    metadata: {
      type: "referral_program_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      reward_description: "$25 off next session for both of you",
      is_test: "true",
    },
    success_url: `${SITE}/referral-program?test=true`,
  },
  slow_day_subscription: {
    name: "TEST — Slow Day SMS ($25/mo)",
    description: "Text one keyword → 200 customers get your promo in 60 seconds. $0 test.",
    mode: "subscription",
    metadata: {
      type: "slow_day_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      promo_offer: "First session free this week only",
      is_test: "true",
    },
    success_url: `${SITE}/slow-day-sms?test=true`,
  },
  homeowner_campaign_subscription: {
    name: "TEST — New Homeowner Campaign ($59/mo)",
    description: "Monthly texts to new movers in your service area before competitors reach them. $0 test.",
    mode: "subscription",
    metadata: {
      type: "homeowner_campaign_subscription",
      email: MATT,
      business_name: "M² Performance Training",
      name: "Matt Michels",
      phone: "+13138064952",
      business_type: "fitness training",
      service_area: "48236, 48230, 48224, Grosse Pointe area",
      is_test: "true",
    },
    success_url: `${SITE}/new-homeowner-campaign?test=true`,
  },
  obituary_service_subscription: {
    name: "TEST — AI Obituary Service ($199/mo)", description: "AI obituary writing for funeral homes. $0 test.",
    mode: "subscription", metadata: { type: "obituary_service_subscription", email: MATT, name: "Matt Michels", funeralHomeName: "M² Test Funeral Home", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/obituary-service?test=true`,
  },
  sermon_prep_subscription: {
    name: "TEST — Sermon Prep ($79/mo)", description: "Weekly AI sermon outlines for pastors. $0 test.",
    mode: "subscription", metadata: { type: "sermon_prep_subscription", email: MATT, name: "Matt Michels", churchName: "M² Test Church", denomination: "Non-denominational", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/sermon-prep?test=true`,
  },
  hoa_secretary_subscription: {
    name: "TEST — HOA Secretary AI ($149/mo)", description: "AI HOA meeting minutes. $0 test.",
    mode: "subscription", metadata: { type: "hoa_secretary_subscription", email: MATT, name: "Matt Michels", hoaName: "M² Test HOA", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/hoa-secretary?test=true`,
  },
  hoa_violation_subscription: {
    name: "TEST — HOA Violation Letters ($149/mo)", description: "AI violation letter generator. $0 test.",
    mode: "subscription", metadata: { type: "hoa_violation_subscription", email: MATT, name: "Matt Michels", hoaName: "M² Test HOA", state: "MI", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/hoa-violation?test=true`,
  },
  rfp_alerts_subscription: {
    name: "TEST — RFP Alert Service ($149/mo)", description: "Daily government contract alerts. $0 test.",
    mode: "subscription", metadata: { type: "rfp_alerts_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", servicesOffered: "Sales training, coaching", geography: "Michigan", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/rfp-alerts?test=true`,
  },
  franchise_analyzer_subscription: {
    name: "TEST — Franchise FDD Analyzer ($299/mo)", description: "AI FDD risk analysis. $0 test.",
    mode: "subscription", metadata: { type: "franchise_analyzer_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/franchise-analyzer?test=true`,
  },
  insurance_drip_subscription: {
    name: "TEST — Insurance Lead Drip ($149/mo)", description: "AI insurance lead follow-up sequences. $0 test.",
    mode: "subscription", metadata: { type: "insurance_drip_subscription", email: MATT, name: "Matt Michels", businessName: "M² Insurance Agency", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/insurance-drip?test=true`,
  },
  str_reputation_subscription: {
    name: "TEST — STR Reputation Manager ($79/mo)", description: "Airbnb host reputation monitor. $0 test.",
    mode: "subscription", metadata: { type: "str_reputation_subscription", email: MATT, name: "Matt Michels", propertyUrls: "https://airbnb.com/rooms/test", propertyCount: "1", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/str-reputation?test=true`,
  },
  grant_discovery_subscription: {
    name: "TEST — Grant Discovery ($199/mo)", description: "Weekly nonprofit grant opportunities. $0 test.",
    mode: "subscription", metadata: { type: "grant_discovery_subscription", email: MATT, name: "Matt Michels", orgName: "M² Foundation", mission: "Helping field sales reps succeed", geography: "Michigan", causeAreas: "education, workforce development", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/grant-discovery?test=true`,
  },
  ag_price_alerts_subscription: {
    name: "TEST — Ag Price Alerts ($79/mo)", description: "Commodity price SMS alerts. $0 test.",
    mode: "subscription", metadata: { type: "ag_price_alerts_subscription", email: MATT, name: "Matt Michels", businessName: "M² Farms", commodities: "corn, soybeans", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/ag-price-alerts?test=true`,
  },
  landlord_letters_subscription: {
    name: "TEST — Landlord-Tenant Letters ($149/mo)", description: "AI state-compliant landlord letters. $0 test.",
    mode: "subscription", metadata: { type: "landlord_letters_subscription", email: MATT, name: "Matt Michels", state: "MI", propertyCount: "3", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/landlord-letters?test=true`,
  },
  regulatory_monitor_subscription: {
    name: "TEST — Regulatory Monitor ($299/mo)", description: "Weekly regulatory change alerts. $0 test.",
    mode: "subscription", metadata: { type: "regulatory_monitor_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", industry: "fitness and wellness", regulatoryBodies: "FTC, OSHA", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/regulatory-monitor?test=true`,
  },
  trade_show_automation_subscription: {
    name: "TEST — Trade Show Follow-Up ($99/mo)", description: "AI badge-scan follow-up sequences. $0 test.",
    mode: "subscription", metadata: { type: "trade_show_automation_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/trade-show-automation?test=true`,
  },
  price_intelligence_subscription: {
    name: "TEST — Competitor Price Intel ($199/mo)", description: "Daily competitor price monitoring. $0 test.",
    mode: "subscription", metadata: { type: "price_intelligence_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", competitorUrls: "https://example.com/pricing", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/price-intelligence?test=true`,
  },
  citation_monitor_subscription: {
    name: "TEST — Citation Monitor ($99/mo)", description: "Weekly NAP consistency monitor. $0 test.",
    mode: "subscription", metadata: { type: "citation_monitor_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", locationCount: "1", primaryAddress: "Grosse Pointe, MI", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/citation-monitor?test=true`,
  },
  menu_engineering_subscription: {
    name: "TEST — Menu Engineering ($99/mo)", description: "Monthly BCG menu analysis. $0 test.",
    mode: "subscription", metadata: { type: "menu_engineering_subscription", email: MATT, name: "Matt Michels", restaurantName: "M² Cafe", cuisineType: "American", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/menu-engineering?test=true`,
  },
  fitness_reports_subscription: {
    name: "TEST — Fitness Progress Reports ($79/mo)", description: "Monthly AI client progress reports. $0 test.",
    mode: "subscription", metadata: { type: "fitness_reports_subscription", email: MATT, name: "Matt Michels", businessName: "M² Performance Training", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/fitness-reports?test=true`,
  },
  gov_meeting_tracker_subscription: {
    name: "TEST — Gov Meeting Tracker ($199/mo)", description: "Weekly zoning and council meeting alerts. $0 test.",
    mode: "subscription", metadata: { type: "gov_meeting_tracker_subscription", email: MATT, name: "Matt Michels", businessName: "M² Development LLC", targetCities: "Grosse Pointe, Detroit", keywords: "commercial, zoning, variance", phone: "+13138064952", is_test: "true" },
    success_url: `${SITE}/gov-meeting-tracker?test=true`,
  },

  // ── 8 NEW AUTONOMOUS PRODUCTS ─────────────────────────────────────────────
  pet_memorial_subscription: {
    name: "TEST — AI Pet Memorial ($79 one-time)",
    description: "Poem, tribute narrative, hosted memorial page + social caption. $0 test.",
    mode: "payment",
    metadata: {
      type: "pet_memorial",
      email: MATT,
      pet_name: "Buddy",
      pet_species: "Dog",
      pet_breed: "Golden Retriever",
      owner_name: "Matt Michels",
      memories: "Loved fetch at the park, always happy, best training buddy",
      is_test: "true",
    },
    success_url: `${SITE}/pet-memorial?test=true`,
  },
  dark_web_monitor_subscription: {
    name: "TEST — Dark Web Monitor ($49/mo)",
    description: "Weekly HIBP credential scan + breach alert email. $0 test.",
    mode: "subscription",
    metadata: {
      type: "dark_web_monitor_subscription",
      email: MATT,
      name: "Matt Michels",
      domain: "mattmichelstraining.com",
      is_test: "true",
    },
    success_url: `${SITE}/dark-web-monitor?test=true`,
  },
  gov_contract_monitor_subscription: {
    name: "TEST — Gov Contract Monitor ($299/mo)",
    description: "Daily SAM.gov bid matching by NAICS code. $0 test.",
    mode: "subscription",
    metadata: {
      type: "gov_contract_monitor_subscription",
      email: MATT,
      name: "Matt Michels",
      business_name: "M² Development LLC",
      naics_codes: "611430,541611",
      past_performance: "Sales training, leadership development, business coaching",
      is_test: "true",
    },
    success_url: `${SITE}/gov-contract-monitor?test=true`,
  },
  podcast_revenue_subscription: {
    name: "TEST — Podcast-to-Revenue Machine ($199/mo)",
    description: "Blog, LinkedIn, email, YouTube, Twitter from each episode. $0 test.",
    mode: "subscription",
    metadata: {
      type: "podcast_revenue_subscription",
      email: MATT,
      name: "Matt Michels",
      podcast_name: "M² Performance Podcast",
      rss_url: "https://feeds.buzzsprout.com/test",
      tone: "motivational, practical",
      is_test: "true",
    },
    success_url: `${SITE}/podcast-revenue?test=true`,
  },
  regulatory_monitor_v2_subscription: {
    name: "TEST — Regulatory Change Monitor ($197/mo)",
    description: "Monday Federal Register digest by industry. $0 test.",
    mode: "subscription",
    metadata: {
      type: "regulatory_monitor_v2_subscription",
      email: MATT,
      name: "Matt Michels",
      business_name: "M² Performance Training",
      industry: "fitness_wellness",
      jurisdiction: "federal",
      is_test: "true",
    },
    success_url: `${SITE}/regulatory-change-monitor?test=true`,
  },
  competitor_pricing_subscription: {
    name: "TEST — Competitor Pricing Intel ($149/mo)",
    description: "Weekly price change detection + AI action recommendations. $0 test.",
    mode: "subscription",
    metadata: {
      type: "competitor_pricing_subscription",
      email: MATT,
      name: "Matt Michels",
      business_name: "M² Performance Training",
      competitor_urls: "https://anytimefitness.com/pricing,https://orangetheory.com/en-us/membership",
      is_test: "true",
    },
    success_url: `${SITE}/competitor-pricing?test=true`,
  },
  re_newsletter_subscription: {
    name: "TEST — Real Estate Newsletter ($79/mo)",
    description: "Weekly branded market report emailed to agent's contact list. $0 test.",
    mode: "subscription",
    metadata: {
      type: "re_newsletter_subscription",
      email: MATT,
      name: "Matt Michels",
      agent_name: "Matt Michels",
      brokerage: "M² Realty",
      target_zip: "48236",
      is_test: "true",
    },
    success_url: `${SITE}/re-newsletter?test=true`,
  },
  trademark_watch_subscription: {
    name: "TEST — Trademark Watch Service ($49/mo)",
    description: "Weekly USPTO similarity scan with oppose/monitor/ignore recommendations. $0 test.",
    mode: "subscription",
    metadata: {
      type: "trademark_watch_subscription",
      email: MATT,
      name: "Matt Michels",
      business_name: "M² Development LLC",
      mark_text: "M2 TRAINING",
      goods_services: "fitness training, performance coaching",
      is_test: "true",
    },
    success_url: `${SITE}/trademark-watch?test=true`,
  },
  employee_credential_audit: {
    name: "TEST — Employee Credential Audit ($149)",
    description: "Checks employee emails against HIBP breach database. $0 test.",
    mode: "payment",
    metadata: {
      type: "employee_credential_audit",
      audit_id: "test-audit-id-placeholder",
      email: MATT,
      company_name: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/employee-credential-audit?test=true`,
  },
  new_hire_breach_check: {
    name: "TEST — New Hire Breach Screen ($9.99)",
    description: "Check candidate email against HIBP breach database. $0 test.",
    mode: "payment",
    metadata: {
      type: "new_hire_breach_check",
      candidate_name: "Test Candidate",
      candidate_email: "test@example.com",
      requester_email: MATT,
      is_test: "true",
    },
    success_url: `${SITE}/new-hire-check?test=true`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    // Verify the caller's JWT — must be a logged-in Supabase user with a Matt email
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized — no auth header" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await sbAuth.auth.getUser();
    const userEmail = userData?.user?.email;
    if (userError || !userEmail || !MATT_EMAILS.includes(userEmail)) {
      console.error("[TEST-CHECKOUT] Auth failed:", userError?.message, "email:", userEmail);
      return new Response(JSON.stringify({ error: "Unauthorized — test checkouts restricted to admin" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { product } = await req.json();
    const email = userEmail;

    const config = TEST_PRODUCTS[product];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown product: ${product}`, available: Object.keys(TEST_PRODUCTS) }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // For employee_credential_audit, pre-create the audit record and use the real UUID
    if (product === "employee_credential_audit") {
      const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
      const { data: auditRow, error: insertError } = await sb
        .from("employee_credential_audits")
        .insert({
          customer_email: MATT,
          company_name: "M² Performance Training",
          employee_emails: ["matt@mattmichelstraining.com", "test@example.com"],
          status: "pending",
          is_test: true,
        })
        .select("id")
        .single();

      if (insertError || !auditRow) {
        console.error("[TEST-CHECKOUT] Failed to pre-create audit record:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create test audit record" }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      config.metadata.audit_id = auditRow.id;
    }

    const lineItem = {
      price_data: {
        currency: "usd",
        product_data: { name: config.name, description: config.description },
        unit_amount: 0,
        ...(config.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
    };

    const sessionParams: any = {
      mode: config.mode,
      line_items: [lineItem],
      customer_email: email,
      metadata: { ...config.metadata, tester_email: email },
      success_url: config.success_url + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `${SITE}/admin`,
    };
    // payment_method_collection only allowed for subscriptions
    if (config.mode === "subscription") {
      sessionParams.payment_method_collection = "if_required";
    }
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[TEST-CHECKOUT] ${product} — $0 session created for ${email}: ${session.id}`);
    return new Response(JSON.stringify({ url: session.url, session_id: session.id, product }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TEST-CHECKOUT]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
