import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Industry rotation ──
const INDUSTRY_ROTATION = [
  "plumber", "electrician", "HVAC contractor", "roofer", "landscaper",
  "auto repair shop", "cleaning service", "tree service", "pressure washing",
  "painting contractor", "carpet cleaning", "moving company", "towing company",
  "locksmith", "pest control", "pool service", "junk removal",
  "concrete contractor", "deck builder", "fence contractor",
  "tattoo studio", "nail salon", "barber shop", "dog grooming",
  "catering company", "food truck", "party rental", "home inspector",
  "mobile mechanic", "chimney sweep", "metal fabrication shop",
  "commercial real estate broker", "industrial equipment dealer",
  "plastic injection molding company", "commercial contractor",
  "commercial property management",
];

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

// ── Extract email from a website ──
async function scrapeEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; M2Bot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    // Find email addresses in HTML
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    // Filter out common junk emails
    const validEmails = emails.filter(e => {
      const lower = e.toLowerCase();
      // Filter out junk: fonts, CDNs, tracking, generic platforms
      const junkDomains = [
        "example.com", "sentry.io", "wixpress.com", "schema.org",
        "googleapis.com", "google.com", "facebook.com", "twitter.com",
        "instagram.com", "w3.org", "jquery.com", "wordpress.org",
        "wordpress.com", "gravatar.com", "cloudflare.com", "amazonaws.com",
        "indiantypefoundry.com", "fontawesome.com", "bootstrapcdn.com",
        "typekit.net", "fonts.com", "monotype.com", "myfonts.com",
        "squarespace.com", "shopify.com", "godaddy.com",
      ];
      if (junkDomains.some(d => lower.includes(d))) return false;
      if (/\.(png|jpg|jpeg|svg|gif|css|js|woff|ttf|eot)$/i.test(lower)) return false;
      if (lower.length > 60 || lower.length < 5) return false;
      // Must have a real TLD
      if (!/\.(com|net|org|biz|info|us|co|io)$/.test(lower)) return false;
      return true;
    });
    return validEmails[0] || null;
  } catch {
    return null;
  }
}

// ── Google Maps Places API: Text Search ──
async function searchGoogleMaps(query: string, apiKey: string): Promise<any[]> {
  const url = `https://places.googleapis.com/v1/places:searchText`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.id,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
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
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [to],
        reply_to: "matt@mattmichelstraining.com",
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:520px;margin:0 auto;padding:24px 0;">
${bodyHtml}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
  <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Development · Grosse Pointe, MI<br>(313) 806-4952</div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
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

// ── Generate outreach email via Lovable AI ──
async function generateOutreachEmail(
  business: string, industry: string, city: string, lovableKey: string
): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `You are Matt Michels, a local business consultant in Grosse Pointe, MI. You help small businesses grow with web design, AI automation, and done-for-you marketing tools. Your tone is straight-talking, local, and personal.` },
        { role: "user", content: `Write a short cold outreach email to "${business}", a ${industry} in ${city}.

Subject line + email body (under 160 words total).

Make it:
- Specific to their industry (mention a real pain they'd recognize)
- Reference that you're local (Grosse Pointe / Metro Detroit)
- Lead with the #1 most relevant service:
  * If HVAC/Plumbing/Roofing/Electrical/Contractor: lead with Missed Call Text-Back ($99/mo)
  * If Restaurant/Retail/Salon/Gym: lead with Text Message Marketing ($79/mo)
  * If Medical/Dental/Healthcare: lead with AI Reputation Dashboard ($79/mo)
  * If Real Estate/Insurance: lead with AI Phone Answering ($149/mo)
  * Otherwise: lead with web design ($499 flat, live in 7 days)
- Briefly mention you also build websites starting at $499 if they need one
- End with: "Takes 30 seconds to get started: mattmichelstraining.com/get-started"
- P.S. line: "P.S. — If you'd rather just text, (313) 806-4952 works too."

Format:
SUBJECT: [subject line]
---
[email body]` },
      ],
      temperature: 0.75,
    }),
  });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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
    let { industry, city, limit = 10, mode } = body;

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

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a 280-char max LinkedIn connection request note from Matt Michels (web design/local marketing, Grosse Pointe MI) to ${ownerName} at ${businessName} in ${leadCity}. Reference their specific industry: ${leadIndustry}. Casual, local, not salesy. No hashtags. Return only the note text.` }],
          }),
        });

        const aiData = await aiRes.json();
        const message = (aiData?.choices?.[0]?.message?.content || "").trim().slice(0, 280);

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

      const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:24px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;"><tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;"><p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">LinkedIn Batch</p><p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr}</p></td></tr><tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;"><p style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:700;">${rows.length} LinkedIn messages ready to send</p><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;"><thead><tr style="background:#f1f5f9;"><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Business</th><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Owner</th><th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">LinkedIn Note</th></tr></thead><tbody>${tableRows}</tbody></table></td></tr><tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;"><div style="display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels"><div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div></div></td></tr></table></td></tr></table></body></html>`;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² System <matt@mattmichelstraining.com>",
            to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
            reply_to: "matt@mattmichelstraining.com",
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

    // ── DEFAULT MODE: Day-rotation prospecting via Google Maps ──
    if (!industry) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      industry = INDUSTRY_ROTATION[dayOfYear % INDUSTRY_ROTATION.length];
    }
    if (!city) {
      const dayOfMonth = new Date().getDate();
      city = CITY_ROTATION[dayOfMonth % CITY_ROTATION.length];
    }

    log("Starting prospecting run", { industry, city, limit, source: "google_maps" });

    // Step 1: Google Maps Text Search
    const places = await searchGoogleMaps(`${industry} in ${city}`, GOOGLE_MAPS_API_KEY);
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

    for (const place of places) {
      if (queued >= limit) break;

      try {
        const gapScore = scoreDigitalGap(place);
        if (gapScore < 30) { skipped++; continue; }

        const businessName = place.displayName?.text || `${industry} in ${city}`;
        const website = place.websiteUri || "";
        const phone = place.nationalPhoneNumber || "";
        const address = place.formattedAddress || "";
        const rating = place.rating || 0;
        const reviewCount = place.userRatingCount || 0;

        // Dedup check against outreach_leads
        const { data: existing } = await serviceClient
          .from("outreach_leads")
          .select("id")
          .ilike("business_name", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        // Step 2: Try to scrape email from their website
        let contactEmail: string | null = null;
        if (website) {
          contactEmail = await scrapeEmailFromWebsite(website);
          // Also try /contact page
          if (!contactEmail) {
            const contactUrl = website.replace(/\/$/, "") + "/contact";
            contactEmail = await scrapeEmailFromWebsite(contactUrl);
          }
          log("Email scrape", { business: businessName, email: contactEmail || "NOT_FOUND" });
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

        // Step 3: Generate outreach email
        const outreachEmail = await generateOutreachEmail(businessName, industry, city, LOVABLE_API_KEY);
        const emailLines = outreachEmail.split("\n");
        const subjectLine = emailLines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim()
          || `Your ${industry} business could be getting more calls`;
        const emailBody = emailLines.slice(emailLines.findIndex(l => l === "---") + 1).join("\n").trim();
        const emailBodyHtml = emailBody.replace(/\n/g, "<br>");

        // Step 4: Auto-send if we have an email address
        let emailStatus = "no_email";
        if (contactEmail && RESEND_API_KEY) {
          const sent = await sendColdEmail(contactEmail, subjectLine, emailBodyHtml, RESEND_API_KEY);
          if (sent) {
            emailStatus = "sent";
            emailed++;
            // Log the send
            await serviceClient.from("email_send_log").insert({
              recipient_email: contactEmail,
              template_name: "cold_outreach",
              status: "sent",
              metadata: { business: businessName, industry, city, gap_score: gapScore },
            });
          } else {
            emailStatus = "send_failed";
          }
          log("Cold email", { business: businessName, email: contactEmail, status: emailStatus });
        }

        // Step 5: Store lead in CRM
        const leadStatus = emailStatus === "sent" ? "Emailed" : "new";
        const { data: newLead, error: insertErr } = await serviceClient
          .from("outreach_leads")
          .insert({
            business_name: businessName,
            email: contactEmail,
            industry,
            city,
            phone,
            website_status: website ? "has_website" : "no_website",
            notes: `Auto-prospected ${new Date().toLocaleDateString()}. Gap score: ${gapScore}/100. Rating: ${rating} (${reviewCount} reviews). Website: ${website || "NONE"}. Address: ${address}. Email: ${contactEmail || "NOT FOUND"}. Email status: ${emailStatus}\n\nSubject: ${subjectLine}\n\n${emailBody}`,
            status: leadStatus,
          })
          .select("id")
          .single();

        if (insertErr) { log("Insert error", { error: insertErr.message }); skipped++; continue; }

        queued++;
        newLeads.push(newLead.id);
        log("Lead processed", { business: businessName, gapScore, email: contactEmail || "none", emailStatus });

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        log("Error processing place", { error: String(err) });
        skipped++;
      }
    }

    log("Run complete", { found: places.length, queued, emailed, skipped, industry, city, source: "google_maps" });

    return new Response(
      JSON.stringify({
        found: places.length,
        queued,
        emailed,
        skipped,
        leads: newLeads,
        industry,
        city,
        source: "google_maps",
        message: `Prospecting complete. ${queued} leads found, ${emailed} cold emails sent to ${industry} businesses in ${city}.`,
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
