import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MapBusiness {
  title: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  category: string | null;
  place_id: string | null;
  claimed: boolean | null;
}

interface HybridResult extends MapBusiness {
  gap_analysis: string | null;
  core_service: string | null;
  specific_site_flaw: string | null;
  recent_activity: string | null;
  lead_score: number | null;
  gap_status: "pending" | "analyzing" | "done" | "skipped" | "error";
  email_status: "found" | "not_found" | "skipped" | "error";
}

// ── Sonar fallback: find businesses via live web search ──
async function sonarFindBusinesses(industry: string, location: string, limit: number): Promise<MapBusiness[]> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://detroitwebagent.com",
      "X-Title": "Detroit Web Agency Prospector",
    },
    body: JSON.stringify({
      model: "perplexity/sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a local business research tool. Return ONLY valid JSON — no markdown, no code fences, no explanation.`,
        },
        {
          role: "user",
          content: `Search the web for ${limit} real "${industry}" businesses in or near "${location}". For each, find their name, phone number, website URL, street address, and Google star rating.

Return ONLY a JSON array. Each object: {"title":"Name","phone":"555-1234","website":"https://example.com","address":"123 Main St","rating":4.5,"reviews":42,"category":"${industry}"}

Use null for missing fields. Return up to ${limit} businesses.`,
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[HYBRID] Sonar search error: ${res.status} ${errText.slice(0, 300)}`);
    throw new Error(`Sonar returned ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "[]";

  let jsonStr = content;
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    console.error("[HYBRID] Sonar JSON parse failed:", jsonStr.slice(0, 300));
    parsed = [];
  }

  return parsed.slice(0, limit).map((item: any) => ({
    title: item.title || item.name || "",
    rating: item.rating ?? null,
    reviews: item.reviews ?? 0,
    address: item.address || "",
    phone: item.phone || null,
    website: item.website || item.url || null,
    email: item.email || null,
    category: item.category || industry,
    place_id: null,
    claimed: null,
  }));
}

// ── Email extraction helpers ──
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const JUNK_DOMAINS = ["example.com","google.com","facebook.com","wix.com","squarespace.com","sentry.io","w3.org","wordpress.org","jquery.com","schema.org","gravatar.com","googleapis.com","gstatic.com","cloudflare.com","bootstrapcdn.com"];

function extractEmailsFromText(text: string): string[] {
  const raw = text.match(EMAIL_REGEX) || [];
  return raw.filter(e => {
    const l = e.toLowerCase();
    return !JUNK_DOMAINS.some(d => l.endsWith(`@${d}`) || l.includes(d))
      && !/\.(png|jpg|svg|js|css|gif|webp)$/i.test(l)
      && l.length < 60 && l.length > 5;
  });
}

// ── Firecrawl-powered email scraping (homepage + contact page) ──
async function scrapeEmailFromSite(websiteUrl: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    // Fallback: basic fetch + regex
    return basicScrapeEmail(websiteUrl);
  }

  let formattedUrl = websiteUrl.trim();
  if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

  try {
    // Step 1: Scrape homepage
    const homeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: formattedUrl, formats: ["markdown", "html"], onlyMainContent: false }),
    });

    if (homeRes.ok) {
      const homeData = await homeRes.json();
      const markdown = homeData?.data?.markdown || homeData?.markdown || "";
      const html = homeData?.data?.html || homeData?.html || "";
      const combined = markdown + " " + html;
      const emails = extractEmailsFromText(combined);
      if (emails.length > 0) {
        console.log(`[HYBRID] Email found on homepage: ${emails[0]}`);
        return emails[0];
      }
    }

    // Step 2: Try common contact pages
    const contactPaths = ["/contact", "/contact-us", "/about", "/about-us"];
    for (const path of contactPaths) {
      try {
        const contactUrl = new URL(path, formattedUrl).href;
        const contactRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: contactUrl, formats: ["markdown", "html"], onlyMainContent: false }),
        });

        if (contactRes.ok) {
          const contactData = await contactRes.json();
          const markdown = contactData?.data?.markdown || contactData?.markdown || "";
          const html = contactData?.data?.html || contactData?.html || "";
          const emails = extractEmailsFromText(markdown + " " + html);
          if (emails.length > 0) {
            console.log(`[HYBRID] Email found on ${path}: ${emails[0]}`);
            return emails[0];
          }
        }
      } catch {
        // Skip failed contact page
      }
    }

    console.log(`[HYBRID] No email found via Firecrawl for ${formattedUrl}`);
    return null;
  } catch (err) {
    console.warn(`[HYBRID] Firecrawl email scrape error for ${formattedUrl}:`, err);
    return basicScrapeEmail(websiteUrl);
  }
}

// ── Basic fetch fallback (no Firecrawl) ──
async function basicScrapeEmail(websiteUrl: string): Promise<string | null> {
  try {
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const res = await fetch(formattedUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const html = await res.text();
    const emails = extractEmailsFromText(html);
    return emails[0] || null;
  } catch { return null; }
}

// ── Structured Gap Analysis via Lovable AI Gateway ──
interface GapResult {
  gap_summary: string;
  core_service: string | null;
  specific_site_flaw: string | null;
  recent_activity: string | null;
  lead_score: number | null;
}

async function analyzeGap(url: string, businessName: string, meta?: { rating?: number | null; reviews?: number | null; email?: string | null; industry?: string | null; city?: string | null }): Promise<GapResult> {
  if (!LOVABLE_API_KEY) {
    console.error("[HYBRID] No LOVABLE_API_KEY — cannot run gap analysis");
    return { gap_summary: "API key not configured", core_service: null, specific_site_flaw: null, recent_activity: null, lead_score: null };
  }

  const systemPrompt = `You are an expert B2B sales researcher for Detroit Web Agency. Analyze the business website and return a structured JSON object. Be highly specific — reference actual elements you can see (or NOT see) on their site.

Return ONLY valid JSON with these keys:
{
  "core_service": "Their main money-making service (e.g., 'Emergency Plumbing', 'Commercial Roofing')",
  "specific_site_flaw": "A highly specific technical or UX failure (e.g., 'Contact form buried on 3rd page', 'No click-to-call on mobile', 'No chat widget for after-hours traffic')",
  "recent_activity": "A recent blog post, project, Google review, or news item — proof you actually looked. Return null if nothing found.",
  "gap_summary": "One sentence describing the biggest automation/revenue gap.",
  "lead_score": "Integer 1-10. Score based on: no website=10, outdated site=7-8, modern but flawed=4-6, already good=1-3. Weight higher if they have lots of reviews (established business that can afford services), are in a core vertical (HVAC/roofing/plumbing/dental), or have a specific fixable flaw."
}

Business metadata: Rating=${meta?.rating ?? "unknown"}, Reviews=${meta?.reviews ?? 0}, Email=${meta?.email ? "found" : "none"}, Industry=${meta?.industry ?? "unknown"}, City=${meta?.city ?? "unknown"}.

No markdown, no code fences, ONLY the JSON object.`;

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Research this business website thoroughly: ${url} (Business: ${businessName}). Extract their core service, a specific site flaw, any recent activity, the biggest gap, and a lead score 1-10.` },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[HYBRID] Gateway gap error for ${url}: ${res.status} ${errText.slice(0, 200)}`);
    throw new Error(`Gateway returned ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";

  try {
    let jsonStr = content;
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
    const parsed = JSON.parse(jsonStr);
    return {
      gap_summary: parsed.gap_summary || content.slice(0, 200),
      core_service: parsed.core_service || null,
      specific_site_flaw: parsed.specific_site_flaw || null,
      recent_activity: parsed.recent_activity || null,
      lead_score: typeof parsed.lead_score === "number" ? Math.min(10, Math.max(1, parsed.lead_score)) : null,
    };
  } catch {
    console.warn(`[HYBRID] Failed to parse structured gap for ${businessName}, using raw`);
    return { gap_summary: content.slice(0, 200), core_service: null, specific_site_flaw: null, recent_activity: null, lead_score: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, location, limit = 10 } = await req.json();

    if (!industry || !location) {
      return new Response(
        JSON.stringify({ error: "industry and location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Find businesses (DataForSEO → Sonar fallback) ──
    const keyword = `${industry} in ${location}`;
    let businesses: MapBusiness[] = [];
    let source = "sonar";

    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      console.log(`[HYBRID] Step 1: Trying DataForSEO for "${keyword}"`);
      const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

      try {
        const mapsRes = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            { keyword, location_name: location, language_code: "en", depth: Math.min(limit, 100) },
          ]),
        });

        const raw = await mapsRes.json();
        const taskStatus = raw.tasks?.[0]?.status_code;

        if (mapsRes.ok && raw.status_code === 20000 && taskStatus === 20000) {
          const items = raw.tasks?.[0]?.result?.[0]?.items || [];
          businesses = items
            .filter((item: any) => item.type === "maps_search" || item.type === "maps_paid" || item.type === "organic")
            .slice(0, limit)
            .map((item: any) => ({
              title: item.title || "",
              rating: item.rating?.value ?? null,
              reviews: item.rating?.votes_count ?? 0,
              address: item.address || item.address_info?.address || "",
              phone: item.phone || null,
              website: item.url || item.domain || null,
              email: null, // Will be enriched later
              category: item.category || "",
              place_id: item.place_id || null,
              claimed: item.is_claimed ?? null,
            }));
          source = "dataforseo";
          console.log(`[HYBRID] DataForSEO returned ${businesses.length} businesses`);
        } else {
          console.warn(`[HYBRID] DataForSEO task_status=${taskStatus}, falling back to Sonar`);
        }
      } catch (dfErr) {
        console.warn(`[HYBRID] DataForSEO error, falling back to Sonar:`, dfErr);
      }
    }

    // Sonar fallback
    if (businesses.length === 0) {
      if (!OPENROUTER_API_KEY) {
        return new Response(
          JSON.stringify({ error: "DataForSEO returned no results and no OPENROUTER_API_KEY configured. Your DataForSEO plan may not include the Google Maps SERP API (error 40501)." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[HYBRID] Step 1: Using Sonar fallback for "${keyword}"`);
      businesses = await sonarFindBusinesses(industry, location, limit);
      source = "sonar";
      console.log(`[HYBRID] Sonar returned ${businesses.length} businesses`);
    }

    console.log(`[HYBRID] Step 1 complete: ${businesses.length} businesses (source: ${source})`);

    // ── Step 2: Email Discovery via Firecrawl (for businesses with websites) ──
    const withWebsites = businesses.filter(b => b.website);
    console.log(`[HYBRID] Step 2: Scraping ${withWebsites.length} websites for emails`);

    const emailBatchSize = 3;
    for (let i = 0; i < withWebsites.length; i += emailBatchSize) {
      const batch = withWebsites.slice(i, i + emailBatchSize);
      const emailResults = await Promise.allSettled(
        batch.map(b => scrapeEmailFromSite(b.website!))
      );
      for (let j = 0; j < batch.length; j++) {
        const result = emailResults[j];
        if (result.status === "fulfilled" && result.value) {
          batch[j].email = result.value;
        }
      }
    }

    const emailsFound = businesses.filter(b => b.email).length;
    console.log(`[HYBRID] Step 2 complete: ${emailsFound}/${businesses.length} emails discovered`);

    // ── Step 3: Gap Analysis via Lovable AI Gateway ──
    const results: HybridResult[] = [];

    if (!LOVABLE_API_KEY && !OPENROUTER_API_KEY) {
      console.warn("[HYBRID] No AI keys — skipping gap analysis");
      for (const b of businesses) {
        results.push({ ...b, gap_analysis: null, core_service: null, specific_site_flaw: null, recent_activity: null, lead_score: null, gap_status: "skipped", email_status: b.email ? "found" : "not_found" });
      }
    } else {
      const withoutSites = businesses.filter(b => !b.website);

      console.log(`[HYBRID] Step 3: Analyzing ${withWebsites.length} websites (${withoutSites.length} skipped — no URL)`);

      const batchSize = 3;
      for (let i = 0; i < withWebsites.length; i += batchSize) {
        const batch = withWebsites.slice(i, i + batchSize);
        const analyses = await Promise.allSettled(
          batch.map(b => analyzeGap(b.website!, b.title, { rating: b.rating, reviews: b.reviews, email: b.email, industry: industry || b.category, city: location?.split(",")[0]?.trim() }))
        );

        for (let j = 0; j < batch.length; j++) {
          const result = analyses[j];
          if (result.status === "fulfilled") {
            const gap = result.value;
            results.push({
              ...batch[j],
              gap_analysis: gap.gap_summary,
              core_service: gap.core_service,
              specific_site_flaw: gap.specific_site_flaw,
              recent_activity: gap.recent_activity,
              lead_score: gap.lead_score,
              gap_status: "done",
              email_status: batch[j].email ? "found" : "not_found",
            });
          } else {
            results.push({
              ...batch[j],
              gap_analysis: "Analysis failed — site may be blocking requests",
              core_service: null,
              specific_site_flaw: null,
              recent_activity: null,
              lead_score: null,
              gap_status: "error",
              email_status: batch[j].email ? "found" : "not_found",
            });
          }
        }
      }

      for (const b of withoutSites) {
        results.push({
          ...b,
          gap_analysis: "No website found — missing entire online presence. Prime candidate for web design services.",
          core_service: null,
          specific_site_flaw: "No website exists",
          recent_activity: null,
          lead_score: 9,
          gap_status: "done",
          email_status: b.email ? "found" : "not_found",
        });
      }
    }

    console.log(`[HYBRID] Complete: ${results.length} results with gap analysis (source: ${source})`);

    return new Response(
      JSON.stringify({ success: true, results, total: results.length, source, emails_found: results.filter(r => r.email).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[HYBRID] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
