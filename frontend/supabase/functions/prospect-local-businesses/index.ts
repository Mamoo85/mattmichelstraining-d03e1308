import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";
import { dwaColdEmail } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Industry rotation ──
const INDUSTRY_ROTATION = [
  // ── PRIORITY: Manufacturing & Commercial Construction (weighted 3x) ──
  "manufacturing company", "machine shop", "fabrication shop",
  "metal fabrication shop", "plastic injection molding company",
  "industrial equipment dealer", "commercial contractor",
  "manufacturing company", "machine shop", "fabrication shop",
  "manufacturing company", "commercial contractor", "industrial equipment dealer",
  // ── PRIORITY: Subcontractors (weighted 2x) ──
  "plumber", "electrician", "HVAC contractor", "roofer",
  "concrete contractor", "fence contractor", "deck builder",
  "plumber", "electrician", "HVAC contractor", "roofer",
  // ── Standard rotation ──
  "landscaper", "auto repair shop", "cleaning service", "tree service",
  "pressure washing", "painting contractor", "carpet cleaning",
  "moving company", "towing company", "locksmith", "pest control",
  "pool service", "junk removal", "tattoo studio", "nail salon",
  "barber shop", "dog grooming", "catering company", "food truck",
  "party rental", "home inspector", "mobile mechanic", "chimney sweep",
  "commercial real estate broker", "commercial property management",
  // High-value verticals
  "dental practice", "dentist", "orthodontist",
  "law firm", "attorney", "personal injury attorney",
  "physical therapy clinic", "chiropractic office", "urgent care clinic",
  "restaurant", "bar and grill", "pizza restaurant",
  "real estate agent", "mortgage broker",
  "accounting firm", "insurance agency",
  "gym", "fitness studio", "crossfit gym",
  "veterinary clinic", "pet grooming",
];

// ── Industry → landing page map (for price segmentation) ──
const INDUSTRY_PAGE_MAP: Record<string, { path: string; price: string; monthly: string }> = {
  "dental practice":        { path: "/dental-web-design",     price: "$499", monthly: "$99/mo" },
  "dentist":                { path: "/dental-web-design",     price: "$499", monthly: "$99/mo" },
  "orthodontist":           { path: "/dental-web-design",     price: "$499", monthly: "$99/mo" },
  "law firm":               { path: "/legal-web-design",      price: "$499", monthly: "$99/mo" },
  "attorney":               { path: "/legal-web-design",      price: "$499", monthly: "$99/mo" },
  "personal injury attorney": { path: "/legal-web-design",   price: "$499", monthly: "$99/mo" },
  "physical therapy clinic":{ path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "chiropractic office":    { path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "urgent care clinic":     { path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "accounting firm":        { path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "insurance agency":       { path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "veterinary clinic":      { path: "/healthcare-web-design", price: "$499", monthly: "$99/mo" },
  "restaurant":             { path: "/restaurant-web-design", price: "$499",   monthly: "$79/mo" },
  "bar and grill":          { path: "/restaurant-web-design", price: "$499",   monthly: "$79/mo" },
  "pizza restaurant":       { path: "/restaurant-web-design", price: "$499",   monthly: "$79/mo" },
  "manufacturing company":  { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "machine shop":           { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "fabrication shop":       { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "metal fabrication shop": { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "plastic injection molding company": { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "industrial equipment dealer": { path: "/manufacturing-web-design", price: "$499", monthly: "$99/mo" },
  "commercial real estate broker": { path: "/real-estate-web-design", price: "$499", monthly: "$99/mo" },
  "real estate agent":      { path: "/real-estate-web-design", price: "$499", monthly: "$99/mo" },
  "mortgage broker":        { path: "/real-estate-web-design", price: "$499", monthly: "$99/mo" },
};
const DEFAULT_PAGE = { path: "/detroit-web-design", price: "$499", monthly: "$49/mo" };

// Per-industry demo preview images — Matt uploads these to /email-assets/ on detroitwebagent.com
const DEMO_IMAGES: Record<string, string> = {
  "/healthcare-web-design":    "https://detroitwebagent.com/email-assets/preview-healthcare-demo.png",
  "/dental-web-design":        "https://detroitwebagent.com/email-assets/preview-dental-demo.png",
  "/legal-web-design":         "https://detroitwebagent.com/email-assets/preview-legal-demo.png",
  "/manufacturing-web-design": "https://detroitwebagent.com/email-assets/preview-manufacturing-demo.png",
  "/real-estate-web-design":   "https://detroitwebagent.com/email-assets/preview-realestate-demo.png",
  "/restaurant-web-design":    "https://detroitwebagent.com/email-assets/preview-restaurant-demo.png",
  "/detroit-web-design":       "https://detroitwebagent.com/email-assets/preview-general-demo.png",
};

// Industry label for the demo caption
const INDUSTRY_LABELS: Record<string, string> = {
  "/healthcare-web-design":    "healthcare",
  "/dental-web-design":        "dental",
  "/legal-web-design":         "legal",
  "/manufacturing-web-design": "manufacturing",
  "/real-estate-web-design":   "real estate",
  "/restaurant-web-design":    "restaurant",
  "/detroit-web-design":       "business",
};

// Build the visual email body HTML — demo screenshot + texting add-ons block + ecosystem line
function buildWebDesignEmailHtml(
  observationHtml: string,  // AI-written observation + stakes (already <br>-escaped)
  landingPage: { path: string; price: string; monthly: string },
): string {
  const demoUrl = `https://detroitwebagent.com${landingPage.path}#demo`;
  const demoImg = DEMO_IMAGES[landingPage.path] || DEMO_IMAGES["/detroit-web-design"];
  const industryLabel = INDUSTRY_LABELS[landingPage.path] || "business";

  return `${observationHtml}

<div style="margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;">
  <a href="${demoUrl}" style="display:block;text-decoration:none;">
    <img src="${demoImg}" alt="${industryLabel} website demo" width="100%"
         style="display:block;width:100%;max-width:520px;height:auto;border-bottom:1px solid #e2e8f0;" />
    <div style="background:#f8fafc;padding:10px 14px;font-size:13px;color:#0ea5e9;font-weight:600;">
      👆 Click to see a live ${industryLabel} demo site →
    </div>
  </a>
</div>

<p style="margin:16px 0 8px;font-size:15px;color:#1e293b;">
  <strong>${landingPage.price} flat.</strong> Professional design, Google-ranked, mobile-ready — <strong>no contract, no agency markup.</strong> ${landingPage.monthly} after that.
</p>

<div style="margin:16px 0;padding:14px 16px;border:2px solid #00d4ff;border-radius:8px;background:#f0fdff;">
  <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0891b2;">Included FREE with every website:</p>
  <p style="margin:4px 0;font-size:14px;color:#0f172a;">📱 <strong>Review Texts</strong> — auto-texts every patient asking for a Google review</p>
  <p style="margin:4px 0;font-size:14px;color:#0f172a;">💳 <strong>Pay-Me Texts</strong> — send a payment link by text, get paid in hours</p>
  <p style="margin:4px 0;font-size:14px;color:#0f172a;">🔔 <strong>Reminder Texts</strong> — automated appointment reminders cut no-shows 40%+</p>
  <p style="margin:4px 0;font-size:14px;color:#0f172a;">👁️ <strong>SiteRadar</strong> — see which companies visit your site every day</p>
</div>

<p style="margin:12px 0;font-size:14px;color:#334155;">
  We also manage Google &amp; Meta ads, and every client gets access to our full growth platform — Trade signals, visitor tracking, and more.
</p>`;
}

function getIndustryPage(industry: string): { path: string; price: string; monthly: string } {
  const lower = industry.toLowerCase();
  for (const [key, val] of Object.entries(INDUSTRY_PAGE_MAP)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return DEFAULT_PAGE;
}

// ── City rotation — national coverage ──
const CITY_ROTATION = [
  // Michigan
  "Detroit MI", "Grand Rapids MI", "Ann Arbor MI", "Warren MI", "Sterling Heights MI",
  "Lansing MI", "Flint MI", "Dearborn MI", "Troy MI", "Livonia MI",
  // Ohio
  "Columbus OH", "Cleveland OH", "Cincinnati OH", "Toledo OH", "Akron OH",
  "Dayton OH", "Canton OH", "Youngstown OH", "Parma OH", "Lorain OH",
  // Indiana
  "Indianapolis IN", "Fort Wayne IN", "South Bend IN", "Evansville IN", "Carmel IN",
  // Illinois
  "Chicago IL", "Aurora IL", "Joliet IL", "Rockford IL", "Naperville IL",
  "Peoria IL", "Springfield IL", "Elgin IL", "Waukegan IL",
  // Wisconsin
  "Milwaukee WI", "Madison WI", "Green Bay WI", "Kenosha WI", "Racine WI",
  // Minnesota
  "Minneapolis MN", "Saint Paul MN", "Rochester MN", "Duluth MN", "Bloomington MN",
  // Missouri
  "Kansas City MO", "St. Louis MO", "Springfield MO", "Columbia MO",
  // Kentucky
  "Louisville KY", "Lexington KY", "Bowling Green KY",
  // Tennessee
  "Nashville TN", "Memphis TN", "Knoxville TN", "Chattanooga TN", "Clarksville TN",
  // Georgia
  "Atlanta GA", "Augusta GA", "Columbus GA", "Macon GA", "Savannah GA", "Marietta GA",
  // Florida
  "Jacksonville FL", "Tampa FL", "Orlando FL", "Miami FL", "St. Petersburg FL",
  "Hialeah FL", "Fort Lauderdale FL", "Tallahassee FL", "Cape Coral FL", "Pembroke Pines FL",
  // Texas
  "Houston TX", "San Antonio TX", "Dallas TX", "Austin TX", "Fort Worth TX",
  "El Paso TX", "Arlington TX", "Corpus Christi TX", "Plano TX", "Lubbock TX",
  "Irving TX", "Garland TX", "Frisco TX", "McKinney TX",
  // North Carolina
  "Charlotte NC", "Raleigh NC", "Greensboro NC", "Durham NC", "Winston-Salem NC",
  "Fayetteville NC", "Cary NC", "Wilmington NC",
  // South Carolina
  "Columbia SC", "Charleston SC", "North Charleston SC", "Greenville SC",
  // Virginia
  "Virginia Beach VA", "Norfolk VA", "Chesapeake VA", "Richmond VA", "Newport News VA",
  "Hampton VA", "Alexandria VA",
  // Maryland
  "Baltimore MD", "Frederick MD", "Rockville MD", "Gaithersburg MD",
  // Pennsylvania
  "Philadelphia PA", "Pittsburgh PA", "Allentown PA", "Erie PA", "Reading PA",
  "Scranton PA", "Bethlehem PA",
  // New York
  "New York NY", "Buffalo NY", "Rochester NY", "Yonkers NY", "Syracuse NY",
  "Albany NY", "New Rochelle NY",
  // New Jersey
  "Newark NJ", "Jersey City NJ", "Paterson NJ", "Elizabeth NJ", "Edison NJ",
  // Connecticut
  "Bridgeport CT", "New Haven CT", "Hartford CT", "Stamford CT",
  // Massachusetts
  "Boston MA", "Worcester MA", "Springfield MA", "Lowell MA", "Cambridge MA",
  // Arizona
  "Phoenix AZ", "Tucson AZ", "Mesa AZ", "Chandler AZ", "Scottsdale AZ",
  "Glendale AZ", "Gilbert AZ", "Tempe AZ",
  // Colorado
  "Denver CO", "Colorado Springs CO", "Aurora CO", "Fort Collins CO", "Lakewood CO",
  "Thornton CO", "Pueblo CO",
  // Nevada
  "Las Vegas NV", "Henderson NV", "Reno NV", "North Las Vegas NV",
  // California
  "Los Angeles CA", "San Diego CA", "San Jose CA", "San Francisco CA", "Fresno CA",
  "Sacramento CA", "Long Beach CA", "Oakland CA", "Bakersfield CA", "Anaheim CA",
  "Santa Ana CA", "Riverside CA", "Stockton CA", "Irvine CA", "Chula Vista CA",
  "Fremont CA", "San Bernardino CA", "Modesto CA",
  // Oregon
  "Portland OR", "Eugene OR", "Salem OR", "Gresham OR", "Beaverton OR",
  // Washington
  "Seattle WA", "Spokane WA", "Tacoma WA", "Vancouver WA", "Bellevue WA",
  "Kent WA", "Everett WA",
  // Alabama
  "Birmingham AL", "Montgomery AL", "Huntsville AL", "Mobile AL",
  // Louisiana
  "New Orleans LA", "Baton Rouge LA", "Shreveport LA", "Lafayette LA",
  // Oklahoma
  "Oklahoma City OK", "Tulsa OK", "Norman OK", "Broken Arrow OK",
  // Kansas
  "Wichita KS", "Overland Park KS", "Kansas City KS", "Topeka KS",
  // Nebraska
  "Omaha NE", "Lincoln NE",
  // Iowa
  "Des Moines IA", "Cedar Rapids IA", "Davenport IA",
  // Arkansas
  "Little Rock AR", "Fort Smith AR", "Fayetteville AR",
  // Utah
  "Salt Lake City UT", "West Valley City UT", "Provo UT", "Ogden UT",
  // Idaho
  "Boise ID", "Meridian ID", "Nampa ID",
  // New Mexico
  "Albuquerque NM", "Las Cruces NM", "Rio Rancho NM",
];

// ── Score digital gap from Google Maps data ──
function scoreDigitalGap(place: any): number {
  let score = 0;
  // No website = huge gap
  if (!place.website) score += 40;
  else score += 5;
  // Low ratings or few reviews = weak online presence
  const rating = place.rating || 0;
  const reviewCount = place.user_ratings_total || place.userRatingCount || 0;
  if (reviewCount < 10) score += 20;
  else if (reviewCount < 30) score += 10;
  if (rating < 3.5 && rating > 0) score += 10;
  // No phone = very weak
  if (!place.formatted_phone_number && !place.nationalPhoneNumber) score += 15;
  // Not permanently closed but low visibility
  if (reviewCount < 5) score += 10;
  return Math.min(score, 95);
}

// ── Snov.io User ID for API calls ──
const SNOV_USER_ID = "f6d756243ea40f113dbb9946740ea111";

// ── Enhanced AI Lead Extraction ──
interface ExtractedLead {
  first_name: string;
  last_name: string;
  job_title: string;
  company_name: string;
  validated_email: string;
  phone_number: string | null;
  drip_campaign_status: {
    current_stage: string;
    email_opened: boolean;
    last_engagement_timestamp: string | null;
  };
  lead_score_indicators: string[];
}

interface ExtractionResult {
  extraction_status: "success" | "failed_no_email" | "no_data_found";
  leads: ExtractedLead[];
}

const AI_EXTRACTION_PROMPT = `<Role>
You are an elite Revenue Operations AI assigned to the Detroit Web Agency. Your objective is to extract, validate, and enrich high-value B2B leads specifically within the Michigan contractor and construction industry (e.g., HVAC, plumbing, general contractors, roofing). You operate with absolute precision and strict adherence to data schemas.
</Role>

<Task>
Analyze the provided scraped HTML/text payload. Execute a deep search to identify key decision-makers (Owners, Founders, Presidents, Project Managers) and extract their contact information. You must bypass basic obfuscation to reconstruct emails.
</Task>

<Rules_of_Engagement>
1. THE EMAIL MANDATE: An email address is the absolute primary key. If you cannot extract or definitively reconstruct a valid email address for a contact, YOU MUST DISCARD THE LEAD ENTIRELY unless the system flag allow_no_email is explicitly passed as true. Do not return partial profiles.
2. DEEP SEARCH TARGETING: Ignore generic contacts (e.g., "info@", "sales@"). Aggressively scan the DOM for personal identifiers associated with leadership or management roles within the contracting business.
3. OBFUSCATION BYPASS: Reconstruct hidden emails. Translate formats like "matt [at] detroitwebagent [dot] com" or "matt(at)detroitwebagent.com" into standard syntax.
4. CRM PARAMETER INITIALIZATION: For every valid lead successfully extracted, you must initialize their CRM tracking parameters exactly as defined in the schema.
</Rules_of_Engagement>

<Formatting_Schema>
You must output ONLY a valid, minified JSON object matching this exact schema. Do not include markdown formatting or conversational filler.

{
  "extraction_status": "success" | "failed_no_email" | "no_data_found",
  "leads": [
    {
      "first_name": "string",
      "last_name": "string",
      "job_title": "string (MUST prioritize Owner/Founder/Manager)",
      "company_name": "string",
      "validated_email": "string (MUST be present)",
      "phone_number": "string | null",
      "drip_campaign_status": {
        "current_stage": "0_New_Extracted_Lead",
        "email_opened": false,
        "last_engagement_timestamp": null
      },
      "lead_score_indicators": [
        "Array of strings detailing why this is a good candidate"
      ]
    }
  ]
}
</Formatting_Schema>`;

async function aiExtractLeads(
  htmlText: string,
  businessName: string,
  industry: string,
  allowNoEmail = false,
): Promise<ExtractionResult> {
  const prompt = `${AI_EXTRACTION_PROMPT}

<Input>
Business Name: ${businessName}
Industry: ${industry}
System Flag: allow_no_email=${allowNoEmail}

--- SCRAPED PAYLOAD START ---
${htmlText.slice(0, 12000)}
--- SCRAPED PAYLOAD END ---
</Input>`;

  const raw = await generateText(prompt, 1200);
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { extraction_status: "no_data_found", leads: [] };
    const parsed = JSON.parse(match[0]) as ExtractionResult;
    // Filter out leads without email unless allow_no_email
    if (!allowNoEmail) {
      parsed.leads = (parsed.leads || []).filter(l => l.validated_email && l.validated_email.includes("@"));
    }
    return parsed;
  } catch {
    return { extraction_status: "no_data_found", leads: [] };
  }
}

// ── Scrape website HTML for AI extraction ──
async function scrapeWebsiteHtml(websiteUrl: string, firecrawlKey?: string): Promise<string | null> {
  // Pass 1: raw fetch (fast, free, works for static sites)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      // If HTML has real content (not a JS-only shell), return it
      if (html.length > 2000) return html;
    }
  } catch { /* fall through */ }

  // Pass 2: Firecrawl — renders JS, bypasses Cloudflare
  if (firecrawlKey) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, formats: ["html"], onlyMainContent: false }),
      });
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        const html = fcData?.data?.html || fcData?.html || "";
        if (html) return html;
      }
    } catch { /* no content */ }
  }

  return null;
}

// ── Legacy simple email scraper (fallback) ──
async function scrapeEmailFromWebsite(websiteUrl: string, firecrawlKey?: string): Promise<string | null> {
  const html = await scrapeWebsiteHtml(websiteUrl, firecrawlKey);
  if (!html) return null;

  const found: string[] = [];
  // 1. mailto: hrefs — most reliable (many sites hide text but keep the href)
  const mailtoRegex = /href=["']mailto:([^"'?\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRegex.exec(html)) !== null) found.push(m[1].trim());

  // 2. Bare email pattern
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  found.push(...(html.match(emailRegex) || []));

  const junkDomains = [
    "example.com", "sentry.io", "wixpress.com", "schema.org",
    "googleapis.com", "google.com", "facebook.com", "twitter.com",
    "instagram.com", "w3.org", "jquery.com", "wordpress.org",
    "wordpress.com", "gravatar.com", "cloudflare.com", "amazonaws.com",
    "squarespace.com", "shopify.com", "godaddy.com",
  ];
  const validEmails = found.filter(e => {
    const lower = e.toLowerCase();
    if (junkDomains.some(d => lower.includes(d))) return false;
    if (/\.(png|jpg|jpeg|svg|gif|css|js|woff|ttf|eot)$/i.test(lower)) return false;
    if (lower.length > 80 || lower.length < 5) return false;
    if (!/\.[a-z]{2,}$/.test(lower)) return false; // any valid TLD
    return true;
  });
  return validEmails[0] || null;
}

// ── Geocode an address to lat/lng ──
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number }> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  );
  const data = await res.json();
  if (data.results?.[0]) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  throw new Error(`Could not geocode: ${address}`);
}

// ── Google Maps Places API: Text Search ──
async function searchGoogleMaps(
  query: string,
  apiKey: string,
  locationBias?: { lat: number; lng: number; radiusMeters: number },
): Promise<any[]> {
  const url = `https://places.googleapis.com/v1/places:searchText`;
  const body: any = { textQuery: query, maxResultCount: 20 };
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: locationBias.radiusMeters,
      },
    };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.id,places.googleMapsUri",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Maps API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.places || [];
}

// ── Send cold email via Resend ──
async function sendColdEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  resendKey: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [to],
        reply_to: "matt@detroitwebagent.com",
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:520px;margin:0 auto;padding:24px 0;">
${bodyHtml}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
  <img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · Grosse Pointe, MI<br>(313) 992-1219</div>
</div>
</div>`,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[PROSPECTOR] Resend error ${res.status}: ${errBody}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`[PROSPECTOR] Send error: ${err}`);
    return false;
  }
}

// ── Agent 1: THE SCOUT — Recon & Qualification ──
async function runScoutAgent(
  business: string, industry: string, city: string,
  website: string, rating: number, reviewCount: number
): Promise<{ target_service_to_pitch: string; custom_flaw_observation: string; lead_score: number }> {
  const prompt = `You are an autonomous B2B Lead Qualification Agent for a web design and automation agency run by Matt Michels in Grosse Pointe, MI. Analyze scraped data about businesses and find their specific digital pain point.

Instructions:
- Check against these triggers:
  Trigger A: Do they have fewer than 20 Google Reviews? (Pitch: GBP Management / Reputation)
  Trigger B: Does their website lack a clear 'Book Now' or lead capture form, or have no website? (Pitch: New Website / Automation)
  Trigger C: Are they missing a web chat widget or after-hours capture? (Pitch: Missed-Call Text Back SaaS $99/mo)
- Output a strictly formatted JSON object with keys: target_service_to_pitch, custom_flaw_observation, lead_score (1-10).
- custom_flaw_observation must be a single, natural-sounding sentence pointing out the flaw.
- lead_score: 1-3 = low priority, 4-6 = moderate, 7-10 = high priority (send email).
- Respond with ONLY the JSON object, no markdown, no explanation.

Business: "${business}"
Industry: ${industry}
City: ${city}
Website: ${website || "NONE - No website found"}
Google Rating: ${rating || "Unknown"}
Google Reviews: ${reviewCount || 0}
Has Website: ${website ? "Yes" : "No"}`;

  const raw = await generateText(prompt, 300);
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { target_service_to_pitch: "web_design", custom_flaw_observation: "I noticed your online presence could use some work.", lead_score: 5 };
  }
}

// ── Agent 2: THE SNIPER — Outbound Copywriter ──
// Writes ONLY the personalized hook (observation + stakes). Pricing, add-ons,
// demo image, and CTA are injected by buildWebDesignEmailHtml() — NOT by the AI.
async function runSniperAgent(
  business: string, industry: string, city: string,
  customFlaw: string, targetService: string,
  landingPage: { path: string; price: string; monthly: string }
): Promise<string> {
  const prompt = `You are a B2B cold email copywriter for a web design agency in Grosse Pointe, MI. Write a short, human-sounding email opener — NOT a full email.

Rules:
- Write exactly 2 short paragraphs. Each paragraph is 1-2 sentences MAX.
- Paragraph 1: The direct observation (use the provided Custom Flaw Observation word-for-word or very close to it).
- Paragraph 2: The stakes — what they are losing because of this (be specific: number of patients/clients, calls, bookings).
- NO pricing. NO solution pitch. NO CTA. NO links. The rest of the email is handled separately.
- Speak like a real person, not a marketer. No corporate words.
- Output ONLY in this format (no extra text, no 'Here is your email'):
  SUBJECT: [subject line — punchy, specific to their business]
  ---
  [paragraph 1]

  [paragraph 2]

Business: "${business}" (${industry} in ${city})
Custom Flaw Observation: "${customFlaw}"
Target Service: ${targetService}`;

  return await generateText(prompt, 400);
}

// ── Check daily volume cap (raised to 60 to support 150/day floor) ──
async function checkDailyVolumeCap(serviceClient: any): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await serviceClient
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("template_name", "cold_outreach")
    .eq("status", "sent")
    .gte("created_at", `${today}T00:00:00Z`);
  return (count || 0) >= 60;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth: allow admin users OR service-role (cron) calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* cron may send empty body */ }
    let { query, location,
          // legacy support
          industry } = body;
    const { city } = body;
    const { radius = 10, limit = 10, mode, minGapScore = 30, hasWebsite, maxReviews } = body;

    // Legacy: convert old-style industry/city to new format
    if (!query && industry) query = industry;
    if (!location && city) location = city;

    // ── LINKEDIN BATCH MODE ──
    if (mode === "linkedin_batch") {
      const { data: leads, error: leadsErr } = await serviceClient
        .from("outreach_leads")
        .select("id, business_name, owner_name, city, industry")
        .eq("status", "Emailed")
        .order("last_contact_date", { ascending: false })
        .limit(20);

      if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);
      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: "No emailed leads found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rows: { id: string; business_name: string; owner_name: string; message: string }[] = [];

      for (const lead of leads) {
        const ownerName = lead.owner_name || "Business Owner";
        const businessName = lead.business_name || "your business";
        const leadCity = lead.city || "Michigan";
        const leadIndustry = lead.industry || "local business";

        const message = (await generateText(`Write a 280-char max LinkedIn connection request note from Matt Michels (web design/local marketing, Grosse Pointe MI) to ${ownerName} at ${businessName} in ${leadCity}. Reference their specific industry: ${leadIndustry}. Casual, local, not salesy. No hashtags. Return only the note text.`, 300)).slice(0, 280);

        await serviceClient.from("outreach_leads").update({ linkedin_message: message }).eq("id", lead.id);
        rows.push({ id: lead.id, business_name: businessName, owner_name: ownerName, message });
        await new Promise(r => setTimeout(r, 300));
      }

      const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const tableRows = rows.map(r => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${r.business_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${r.owner_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;">${r.message}</td>
        </tr>`).join("");

      const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:24px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;"><tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;"><p style="margin:0;color:#22d3ee;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">LinkedIn Batch</p><p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr}</p></td></tr><tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;"><p style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:700;">${rows.length} LinkedIn messages ready to send</p><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;"><thead><tr style="background:#f1f5f9;"><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Business</th><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Owner</th><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">LinkedIn Note</th></tr></thead><tbody>${tableRows}</tbody></table></td></tr><tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;"><div style="display:flex;align-items:center;gap:12px;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels"><div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219</div></div></td></tr></table></td></tr></table></body></html>`;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: ["matt@detroitwebagent.com"], bcc: ["matthewmichels4@gmail.com"],
            reply_to: "matt@detroitwebagent.com",
            subject: `${rows.length} LinkedIn messages ready to send — ${dateStr}`,
            html: emailHtml,
          }),
        });
      }

      log("LinkedIn batch complete", { count: rows.length });
      return new Response(JSON.stringify({ sent: rows.length, mode: "linkedin_batch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CONTRACTOR LEAD PITCH MODE ──
    if (mode === "contractor_lead_pitch") {
      const CONTRACTOR_INDUSTRIES = ["roofing contractor", "HVAC contractor", "plumbing contractor", "electrician", "gutter company"];
      const CONTRACTOR_CITIES = ["Detroit MI", "Warren MI", "Sterling Heights MI", "Livonia MI", "Ann Arbor MI", "Dearborn MI", "Troy MI", "Southfield MI", "Pontiac MI", "Royal Oak MI"];
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const contractorIndustry = CONTRACTOR_INDUSTRIES[dayOfYear % CONTRACTOR_INDUSTRIES.length];
      const contractorCity = CONTRACTOR_CITIES[new Date().getDate() % CONTRACTOR_CITIES.length];

      // Use Google Maps to find contractors
      const places = await searchGoogleMaps(`${contractorIndustry} in ${contractorCity}`, GOOGLE_MAPS_API_KEY);
      log("Google Maps contractor results", { count: places.length });

      let pitched = 0;
      for (const place of places.slice(0, 10)) {
        const businessName = place.displayName?.text || "your business";
        const website = place.websiteUri || "";
        const phone = place.nationalPhoneNumber || "";
        const address = place.formattedAddress || "";

        // Skip if no way to contact
        if (!website && !phone) continue;

        // Store as outreach lead
        const { data: existing } = await serviceClient
          .from("outreach_leads")
          .select("id")
          .ilike("business_name", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const gapScore = scoreDigitalGap(place);

        await serviceClient.from("outreach_leads").insert({
          business_name: businessName,
          industry: contractorIndustry,
          city: contractorCity,
          phone,
          website_status: website ? "has_website" : "no_website",
          notes: `Auto-prospected via Google Maps. Gap score: ${gapScore}/100. Rating: ${place.rating || "N/A"} (${place.userRatingCount || 0} reviews). Website: ${website || "NONE"}. Address: ${address}`,
          status: "new",
        });

        pitched++;
      }

      log("Contractor lead pitch complete", { pitched, industry: contractorIndustry, city: contractorCity });
      return new Response(JSON.stringify({ pitched, mode: "contractor_lead_pitch", source: "google_maps" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DEFAULT MODE: Radius-based prospecting via Google Maps ──
    // For cron runs (no body), fall back to day-rotation
    if (!query) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      query = INDUSTRY_ROTATION[dayOfYear % INDUSTRY_ROTATION.length];
      // Keep legacy industry for landing page lookup
      if (!industry) industry = query;
    }
    if (!location) {
      const dayOfMonth = new Date().getDate();
      location = CITY_ROTATION[dayOfMonth % CITY_ROTATION.length];
    }

    const landingPage = getIndustryPage(industry || query);
    log("Starting prospecting run", { query, location, radius, limit, minGapScore, source: "google_maps", landingPage: landingPage.path });

    // Step 1: Geocode location + Google Maps Text Search with radius
    let locationBias: { lat: number; lng: number; radiusMeters: number } | undefined;
    try {
      const coords = await geocodeAddress(location, GOOGLE_MAPS_API_KEY);
      const radiusMeters = Math.min((radius || 10) * 1609, 50000); // miles → meters, max 50km
      locationBias = { lat: coords.lat, lng: coords.lng, radiusMeters };
      log("Geocoded location", { location, ...coords, radiusMeters });
    } catch (geoErr) {
      log("Geocoding failed, searching without location bias", { error: String(geoErr) });
    }

    const searchQuery = query.includes(" in ") ? query : `${query} in ${location}`;
    const places = await searchGoogleMaps(searchQuery, GOOGLE_MAPS_API_KEY, locationBias);
    log("Google Maps results", { count: places.length });

    if (places.length === 0) {
      return new Response(JSON.stringify({ found: 0, queued: 0, skipped: 0, message: "No results from Google Maps", source: "google_maps" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    let queued = 0;
    let skipped = 0;
    let emailed = 0;
    const newLeads: string[] = [];

    // Check daily volume cap before sending any emails
    const capReached = await checkDailyVolumeCap(serviceClient);
    if (capReached) {
      log("Daily volume cap reached (40 emails). Discovery only, no sends.");
    }

    for (const place of places) {
      if (queued >= limit) break;

      try {
        const gapScore = scoreDigitalGap(place);
        if (gapScore < (minGapScore || 30)) { skipped++; continue; }

        const businessName = place.displayName?.text || `${query} in ${location}`;
        const website = place.websiteUri || "";
        const phone = place.nationalPhoneNumber || "";
        const address = place.formattedAddress || "";
        const rating = place.rating || 0;
        const reviewCount = place.userRatingCount || 0;

        // Apply optional filters
        if (hasWebsite === "yes" && !website) { skipped++; continue; }
        if (hasWebsite === "no" && website) { skipped++; continue; }
        if (maxReviews && reviewCount > maxReviews) { skipped++; continue; }

        // Dedup check against outreach_leads
        const { data: existing } = await serviceClient
          .from("outreach_leads")
          .select("id")
          .ilike("business_name", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        // ── ENHANCED AI EXTRACTION PIPELINE ──
        let contactEmail: string | null = null;
        let enrichmentSource = "ai_extraction";
        let decisionMakerName: string | null = null;
        let decisionMakerTitle: string | null = null;
        let directPhone: string | null = null;
        let verifiedEmail = false;
        let extractedFirstName: string | null = null;
        let extractedLastName: string | null = null;
        let extractedCompany: string | null = null;
        let dripCampaignStatus: any = { current_stage: "0_New_Extracted_Lead", email_opened: false, last_engagement_timestamp: null };
        let leadScoreIndicators: string[] = [];

        if (website) {
          // Step 1: Scrape HTML from main page + /contact + /about
          const pagesToScrape = [
            website,
            website.replace(/\/$/, "") + "/contact",
            website.replace(/\/$/, "") + "/about",
          ];
          let combinedHtml = "";
          for (const pageUrl of pagesToScrape) {
            const html = await scrapeWebsiteHtml(pageUrl, FIRECRAWL_API_KEY);
            if (html) combinedHtml += `\n<!-- PAGE: ${pageUrl} -->\n${html}`;
          }

          // Step 2: AI Extraction with the elite prompt
          if (combinedHtml.length > 100) {
            const extraction = await aiExtractLeads(combinedHtml, businessName, industry || query);
            log("AI extraction", { business: businessName, status: extraction.extraction_status, leadCount: extraction.leads?.length || 0 });

            if (extraction.extraction_status === "success" && extraction.leads?.length > 0) {
              const bestLead = extraction.leads[0];
              contactEmail = bestLead.validated_email;
              extractedFirstName = bestLead.first_name;
              extractedLastName = bestLead.last_name;
              decisionMakerName = `${bestLead.first_name} ${bestLead.last_name}`.trim();
              decisionMakerTitle = bestLead.job_title;
              extractedCompany = bestLead.company_name;
              if (bestLead.phone_number) directPhone = bestLead.phone_number;
              dripCampaignStatus = bestLead.drip_campaign_status || dripCampaignStatus;
              leadScoreIndicators = bestLead.lead_score_indicators || [];
              enrichmentSource = "ai_extraction";
            } else if (extraction.extraction_status === "failed_no_email") {
              // AI found data but no email — discard unless we try waterfall
              log("AI extraction: no email found, trying waterfall", { business: businessName });
            }
          }

          // Step 3: Fallback to simple regex scrape (+ Firecrawl) if AI found nothing
          if (!contactEmail) {
            contactEmail = await scrapeEmailFromWebsite(website, FIRECRAWL_API_KEY);
            if (contactEmail) enrichmentSource = "regex_scrape";
          }
          if (!contactEmail) {
            const contactUrl = website.replace(/\/$/, "") + "/contact";
            contactEmail = await scrapeEmailFromWebsite(contactUrl, FIRECRAWL_API_KEY);
            if (contactEmail) enrichmentSource = "regex_scrape_contact";
          }
          if (!contactEmail) {
            const contactUrl2 = website.replace(/\/$/, "") + "/contact-us";
            contactEmail = await scrapeEmailFromWebsite(contactUrl2, FIRECRAWL_API_KEY);
            if (contactEmail) enrichmentSource = "regex_scrape_contact_us";
          }

          // Step 4: Waterfall enrichment APIs as final fallback
          if (!contactEmail || !phone) {
            try {
              const enrichRes = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
                body: JSON.stringify({ website, business_name: businessName }),
              });
              if (enrichRes.ok) {
                const enrichData = await enrichRes.json();
                if (enrichData.email && !contactEmail) {
                  contactEmail = enrichData.email;
                  enrichmentSource = enrichData.enrichment_source || "waterfall";
                }
                if (enrichData.verified_email) verifiedEmail = true;
                if (enrichData.decision_maker_name && !decisionMakerName) decisionMakerName = enrichData.decision_maker_name;
                if (enrichData.decision_maker_title && !decisionMakerTitle) decisionMakerTitle = enrichData.decision_maker_title;
                if (enrichData.direct_phone && !directPhone) directPhone = enrichData.direct_phone;
                log("Waterfall enrichment", {
                  business: businessName,
                  source: enrichData.enrichment_source,
                  email: enrichData.email || "none",
                });
              }
            } catch (enrichErr) {
              log("Waterfall enrichment failed (non-blocking)", { error: String(enrichErr) });
            }
          }

          log("Final extraction result", { business: businessName, email: contactEmail || "NOT_FOUND", source: enrichmentSource, decisionMaker: decisionMakerName });
        }

        // Dedup against email_send_log if we have an email
        if (contactEmail) {
          const { data: alreadySent } = await serviceClient
            .from("email_send_log")
            .select("id")
            .eq("recipient_email", contactEmail)
            .eq("template_name", "cold_outreach")
            .limit(1);
          if (alreadySent && alreadySent.length > 0) {
            log("Already emailed", { email: contactEmail });
            skipped++;
            continue;
          }
        }

        // ── AGENT 1: THE SCOUT — Qualify the lead ──
        const scoutResult = await runScoutAgent(
          businessName, industry || query, location, website, rating, reviewCount
        );
        log("Scout result", { business: businessName, score: scoutResult.lead_score, service: scoutResult.target_service_to_pitch, flaw: scoutResult.custom_flaw_observation });

        // ── AGENT 2: THE SNIPER — Write & send email if score >= 7 ──
        let emailStatus = "no_email";
        let subjectLine = "";
        let emailBody = "";

        if (scoutResult.lead_score >= 7 && contactEmail && RESEND_API_KEY && !capReached) {
          const sniperOutput = await runSniperAgent(
            businessName, industry || query, location,
            scoutResult.custom_flaw_observation, scoutResult.target_service_to_pitch,
            landingPage
          );

          const emailLines = sniperOutput.split("\n");
          subjectLine = emailLines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim()
            || `Quick observation about ${businessName}`;
          emailBody = emailLines.slice(emailLines.findIndex(l => l === "---") + 1).join("\n").trim();
          // Render the observation paragraphs as HTML, then inject the full visual template
          const observationHtml = emailBody
            .split(/\n\n+/)
            .map(para => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#1e293b;">${para.replace(/\n/g, "<br>")}</p>`)
            .join("");
          const richBodyHtml = buildWebDesignEmailHtml(observationHtml, landingPage);
          const ctaUrl = `https://detroitwebagent.com${landingPage.path}#demo`;

          const r = await dwaColdEmail({
            to: contactEmail,
            subject: subjectLine,
            bodyHtml: richBodyHtml,
            product: "Detroit Web Agency",
            ctaUrl,
            templateName: "cold_outreach",
          }, serviceClient);
          const sent = r.ok;
          if (sent) {
            emailStatus = "sent";
            emailed++;
            dripCampaignStatus.current_stage = "1_Initial_Email_Sent";
            // ── Bridge into web_design_leads so the 4-step drip picks this lead up ──
            const { data: existingWdl } = await serviceClient
              .from("web_design_leads" as any)
              .select("id")
              .ilike("email", contactEmail)
              .limit(1);
            if (!existingWdl || existingWdl.length === 0) {
              await serviceClient.from("web_design_leads" as any).insert({
                name: decisionMakerName || businessName,
                business: businessName,
                email: contactEmail,
                phone: directPhone || phone || null,
                status: "new",
                description: `SOURCE: auto_prospected | INDUSTRY: ${industry || query} | LOCATION: ${location} | LANDING_PAGE: ${landingPage.path} | DECISION_MAKER: ${decisionMakerName || "unknown"} (${decisionMakerTitle || "unknown"})`,
              });
              log("Bridged into web_design_leads for drip", { email: contactEmail, industry: industry || query });
            }
          } else {
            emailStatus = "send_failed";
          }
          log("Sniper email", { business: businessName, email: contactEmail, status: emailStatus });
        } else if (scoutResult.lead_score < 7) {
          emailStatus = "low_score";
          log("Lead below threshold", { business: businessName, score: scoutResult.lead_score });
        }

        // Store lead in CRM with enhanced agent data + new columns
        const leadStatus = emailStatus === "sent" ? "Emailed" : "new";
        const { data: newLead, error: insertErr } = await serviceClient
          .from("outreach_leads")
          .upsert({
            business_name: businessName,
            email: contactEmail,
            validated_email: contactEmail,
            first_name: extractedFirstName,
            last_name: extractedLastName,
            job_title: decisionMakerTitle,
            company_name: extractedCompany || businessName,
            owner_name: decisionMakerName,
            industry: industry || query,
            city: location,
            phone: directPhone || phone,
            website_status: website ? "has_website" : "no_website",
            lead_score: scoutResult.lead_score,
            target_service: scoutResult.target_service_to_pitch,
            custom_flaw: scoutResult.custom_flaw_observation,
            drip_campaign_status: dripCampaignStatus,
            lead_score_indicators: leadScoreIndicators,
            notes: `Auto-prospected ${new Date().toLocaleDateString()}. Gap score: ${gapScore}/100. Lead score: ${scoutResult.lead_score}/10. Target: ${scoutResult.target_service_to_pitch}. Flaw: ${scoutResult.custom_flaw_observation}. Rating: ${rating} (${reviewCount} reviews). Website: ${website || "NONE"}. Address: ${address}. Enrichment: ${enrichmentSource}. Email status: ${emailStatus}.${subjectLine ? `\n\nSubject: ${subjectLine}\n\n${emailBody}` : ""}`,
            status: leadStatus,
          }, { onConflict: "email", ignoreDuplicates: false })
          .select("id")
          .single();

        if (insertErr) { log("Insert error", { error: insertErr.message }); skipped++; continue; }

        queued++;
        newLeads.push(newLead.id);
        log("Lead processed", { business: businessName, gapScore, leadScore: scoutResult.lead_score, email: contactEmail || "none", emailStatus });

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        log("Error processing place", { error: String(err) });
        skipped++;
      }
    }

    log("Run complete", { found: places.length, queued, emailed, skipped, query, location, radius, source: "google_maps" });

    return new Response(
      JSON.stringify({
        found: places.length,
        queued,
        emailed,
        skipped,
        leads: newLeads,
        query,
        location,
        radius,
        source: "google_maps",
        message: `Prospecting complete. ${queued} leads found, ${emailed} cold emails sent for "${query}" within ${radius}mi of ${location}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
