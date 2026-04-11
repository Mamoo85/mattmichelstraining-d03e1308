import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_SIZE = 5;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SCRAPE_PATHS = ["/", "/contact", "/about", "/contact-us"];
const FIRECRAWL_TIMEOUT = 8000;

type JsonRecord = Record<string, unknown>;

interface MapBusiness {
  title: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  place_id: string | null;
  claimed: boolean | null;
}

interface EnrichmentData {
  email: string | null;
  name: string | null;
  phone: string | null;
  verifiedEmail: boolean;
  source: string | null;
}

interface PreparedLead {
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string;
  google_rating: number | null;
  review_count: number | null;
  gbp_claimed: boolean | null;
  google_place_id: string | null;
  pipeline_stage: string;
  source: string;
  gap_analysis?: string | null;
}

type ProcessResult =
  | { kind: "ready"; lead: PreparedLead }
  | { kind: "discarded"; business_name: string; reason: string }
  | { kind: "failed"; business_name: string; error: string };

type SaveResult =
  | { kind: "saved"; lead: PreparedLead; id: string | null; dripTriggered: boolean }
  | { kind: "failed"; business_name: string; error: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const formatted = url.startsWith("http") ? url : `https://${url}`;
    return new URL(formatted).toString();
  } catch {
    return null;
  }
}

function extractDomain(url: string | null | undefined): string | null {
  const normalized = normalizeWebsite(url);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function parseLocation(location: string | null | undefined) {
  const [cityPart, statePart] = (location || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return { city: cityPart || null, state: statePart || null };
}

function createEmptyResponse(overrides: JsonRecord = {}) {
  return {
    success: true,
    total: 0,
    processed: 0,
    saved: 0,
    discarded: 0,
    failed: 0,
    discarded_names: [] as string[],
    successful_leads: [] as PreparedLead[],
    results: [] as PreparedLead[],
    drip_triggered: 0,
    chunk_size: CHUNK_SIZE,
    errors: [] as Array<{ stage: string; business_name?: string; message: string }>,
    ...overrides,
  };
}

// ─── PHASE 1: Deep Crawl (concurrent multi-page scrape) ───
async function deepCrawl(baseUrl: string): Promise<{ combinedText: string; pageTexts: string[] }> {
  if (!FIRECRAWL_API_KEY) return { combinedText: "", pageTexts: [] };

  const urls = SCRAPE_PATHS.map((path) => {
    try {
      return new URL(path, baseUrl).toString();
    } catch {
      return null;
    }
  }).filter(Boolean) as string[];

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT);
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            onlyMainContent: false,
            timeout: FIRECRAWL_TIMEOUT,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) { await res.text(); return ""; }
        const data = await res.json();
        return (data?.data?.markdown || data?.markdown || "").slice(0, 5000);
      } catch {
        clearTimeout(timeoutId);
        return "";
      }
    }),
  );

  const pageTexts = results
    .map((r) => (r.status === "fulfilled" ? r.value : ""))
    .filter((t) => t.length > 50);

  return {
    combinedText: pageTexts.join("\n\n---PAGE BREAK---\n\n"),
    pageTexts,
  };
}

// ─── PHASE 2: Regex Hard Extraction (before any AI) ───
function regexExtractEmails(text: string, domain: string | null): string[] {
  const allMatches = Array.from(new Set(text.match(EMAIL_REGEX) || []));
  // Filter out generic noreply/support/spam and non-domain emails
  const dominated = domain
    ? allMatches.filter((e) => {
        const d = e.split("@")[1]?.toLowerCase();
        return d === domain.toLowerCase();
      })
    : allMatches;
  // Exclude generic addresses, prefer personal
  const junk = ["noreply", "no-reply", "support", "sales", "billing", "privacy", "abuse", "spam", "webmaster", "postmaster"];
  const personal = dominated.filter((e) => !junk.some((j) => e.toLowerCase().startsWith(j)));
  // Return personal first, then generic domain emails, then any
  if (personal.length > 0) return personal;
  if (dominated.length > 0) return dominated;
  // Fallback: return any email found (even off-domain)
  const offDomain = allMatches.filter((e) => !junk.some((j) => e.toLowerCase().startsWith(j)));
  return offDomain.slice(0, 5);
}

// ─── PHASE 3: Auto-Audit Loop (AI extraction + waterfall fallback) ───
async function aiExtractEmail(
  combinedText: string,
  businessName: string,
  domain: string,
): Promise<{ email: string | null; name: string | null; phone: string | null }> {
  if (!LOVABLE_API_KEY || !combinedText.trim()) return { email: null, name: null, phone: null };

  const prompt = `You are extracting the owner/decision-maker contact from "${businessName}" (domain: ${domain}).

Analyze this website content and find:
1. The owner/founder/CEO's email address (MUST use @${domain})
2. Their full name
3. Their direct phone number

If you see a person's name but no email, RECONSTRUCT it: first@${domain}, first.last@${domain}, etc.

Website content:
${combinedText.slice(0, 12000)}

Return JSON only: {"email":"...","name":"...","phone":"..."}
If nothing found, return {"email":null,"name":null,"phone":null}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) { await res.text(); return { email: null, name: null, phone: null }; }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { email: null, name: null, phone: null };
    const parsed = JSON.parse(match[0]);
    return {
      email: parsed.email && parsed.email.includes("@") ? parsed.email : null,
      name: parsed.name || null,
      phone: parsed.phone || null,
    };
  } catch {
    return { email: null, name: null, phone: null };
  }
}

async function enrichViaWaterfall(params: {
  domain: string;
  businessName: string;
  industry: string;
  website: string | null;
  allowEmailGuess: boolean;
}): Promise<EnrichmentData> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: params.domain,
        business_name: params.businessName,
        industry: params.industry,
        website: params.website,
        allow_email_guess: params.allowEmailGuess,
      }),
    });
    if (!res.ok) {
      await res.text();
      return { email: null, name: null, phone: null, verifiedEmail: false, source: null };
    }
    const data = await res.json();
    return {
      email: typeof data?.email === "string" ? data.email : null,
      name: data?.decision_maker_name || data?.contact_name || null,
      phone: data?.direct_phone || data?.phone || null,
      verifiedEmail: Boolean(data?.verified_email),
      source: data?.enrichment_source || null,
    };
  } catch {
    return { email: null, name: null, phone: null, verifiedEmail: false, source: null };
  }
}

// ─── DataForSEO Maps Search ───
async function mapsSearch(industry: string, location: string, limit: number): Promise<MapBusiness[]> {
  const login = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
  const password = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";
  if (!login || !password) throw new Error("DataForSEO credentials not configured");

  const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${login}:${password}`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      keyword: `${industry} near ${location}`,
      location_name: "United States",
      language_name: "English",
      depth: Math.min(limit, 100),
    }]),
  });

  const data = await res.json();
  if (data?.status_code !== 20000) {
    console.error("[OmniEngine] DataForSEO error:", JSON.stringify(data?.status_message ?? data));
    return [];
  }

  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items
    .filter((item: any) => item.type === "maps_search")
    .slice(0, limit)
    .map((item: any) => ({
      title: item.title || "Unknown",
      rating: item.rating?.value ?? null,
      reviews: item.rating?.votes_count ?? null,
      address: item.address || null,
      phone: item.phone || null,
      website: item.url || item.domain || null,
      category: item.category || null,
      place_id: item.place_id || null,
      claimed: item.is_claimed ?? null,
    }));
}

// ─── CORE: Process a single business through the 4-phase pipeline ───
async function processBusiness(
  business: MapBusiness,
  industry: string,
  location: string,
  strictEmailFilter: boolean,
  allowEmailGuess: boolean,
): Promise<ProcessResult> {
  try {
    const website = normalizeWebsite(business.website);
    const domain = extractDomain(website);
    const { city, state } = parseLocation(location);

    let foundEmail: string | null = null;
    let contactName: string | null = null;
    let contactPhone: string | null = business.phone;
    let enrichSource = "none";
    let gapText = "";

    // ═══════════════════════════════════════════
    // PHASE 1: Deep Crawl — scrape /, /contact, /about, /contact-us concurrently
    // ═══════════════════════════════════════════
    let crawlResult = { combinedText: "", pageTexts: [] as string[] };
    if (website) {
      console.log(`[OmniEngine] Phase 1: Deep crawl ${business.title} (${website})`);
      crawlResult = await deepCrawl(website);
      gapText = crawlResult.combinedText.slice(0, 2000);
    }

    // ═══════════════════════════════════════════
    // PHASE 2: Regex Hard Extraction — scan raw text BEFORE any AI
    // ═══════════════════════════════════════════
    if (crawlResult.combinedText.length > 50) {
      console.log(`[OmniEngine] Phase 2: Regex scan ${business.title} (${crawlResult.combinedText.length} chars)`);
      const regexEmails = regexExtractEmails(crawlResult.combinedText, domain);
      if (regexEmails.length > 0) {
        foundEmail = regexEmails[0];
        enrichSource = "regex_direct";
        console.log(`[OmniEngine] ✅ Regex found email for ${business.title}: ${foundEmail}`);
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 3A: If regex failed → AI extraction from scraped content
    // ═══════════════════════════════════════════
    if (!foundEmail && crawlResult.combinedText.length > 100 && domain) {
      console.log(`[OmniEngine] Phase 3A: AI extraction for ${business.title}`);
      const aiResult = await aiExtractEmail(crawlResult.combinedText, business.title, domain);
      if (aiResult.email) {
        foundEmail = aiResult.email;
        enrichSource = "ai_extraction";
        console.log(`[OmniEngine] ✅ AI found email for ${business.title}: ${foundEmail}`);
      }
      if (aiResult.name) contactName = aiResult.name;
      if (aiResult.phone) contactPhone = aiResult.phone;
    }

    // ═══════════════════════════════════════════
    // PHASE 3B: If still no email → full enrichment waterfall (Hunter/Apollo/Lusha/etc)
    // ═══════════════════════════════════════════
    if (!foundEmail && domain) {
      console.log(`[OmniEngine] Phase 3B: Waterfall enrichment for ${business.title}`);
      const enrichment = await enrichViaWaterfall({
        domain,
        businessName: business.title,
        industry,
        website,
        allowEmailGuess,
      });
      if (enrichment.email) {
        foundEmail = enrichment.email;
        enrichSource = `waterfall_${enrichment.source || "unknown"}`;
        console.log(`[OmniEngine] ✅ Waterfall found email for ${business.title}: ${foundEmail}`);
      }
      if (enrichment.name && !contactName) contactName = enrichment.name;
      if (enrichment.phone && !contactPhone) contactPhone = enrichment.phone;
    }

    // ═══════════════════════════════════════════
    // PHASE 4: Strict Upsert — determine pipeline_stage based on outcome
    // ═══════════════════════════════════════════
    if (strictEmailFilter && !foundEmail) {
      return {
        kind: "discarded",
        business_name: business.title,
        reason: "No email found after deep crawl + regex + AI + waterfall",
      };
    }

    const pipelineStage = foundEmail ? "new_lead" : "email_missing";

    return {
      kind: "ready",
      lead: {
        business_name: business.title,
        contact_name: contactName,
        email: foundEmail,
        phone: contactPhone,
        website,
        city,
        state,
        industry,
        google_rating: business.rating,
        review_count: business.reviews,
        gbp_claimed: business.claimed,
        google_place_id: business.place_id,
        pipeline_stage: pipelineStage,
        source: "omni_engine",
        gap_analysis: gapText
          ? `[${enrichSource}] Website context:\n\n${gapText}`
          : null,
      },
    };
  } catch (error) {
    return {
      kind: "failed",
      business_name: business.title,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function saveLead(
  serviceClient: ReturnType<typeof createClient>,
  lead: PreparedLead,
): Promise<SaveResult> {
  try {
    const { data: upserted, error } = await serviceClient
      .from("prospect_pipeline")
      .upsert(lead, { onConflict: "business_name,city" })
      .select("id, email, drip_step")
      .maybeSingle();

    if (error) {
      return { kind: "failed", business_name: lead.business_name, error: error.message };
    }

    let dripTriggered = false;
    if (upserted?.id && upserted?.email && (!upserted.drip_step || upserted.drip_step === 0)) {
      try {
        const dripRes = await fetch(`${SUPABASE_URL}/functions/v1/pipeline-auto-drip`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode: "trigger", lead_id: upserted.id }),
        });
        if (dripRes.ok) dripTriggered = true;
        else {
          const t = await dripRes.text();
          console.error("[OmniEngine] Drip trigger non-OK:", dripRes.status, t.slice(0, 200));
        }
      } catch (error) {
        console.error("[OmniEngine] Drip trigger error:", error);
      }
    }

    return { kind: "saved", lead, id: upserted?.id ?? null, dripTriggered };
  } catch (error) {
    return {
      kind: "failed",
      business_name: lead.business_name,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Auth failed" }, 401);

  try {
    const body = await req.json();
    const industry = typeof body?.industry === "string" ? body.industry.trim() : "";
    const location = typeof body?.location === "string" ? body.location.trim() : "Michigan";
    const requestedLimit = Number(body?.limit ?? 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.floor(requestedLimit))) : 10;
    const strictEmailFilter = body?.strict_email_filter === true;
    const allowEmailGuess = body?.allow_email_guess !== false;

    if (!industry) {
      return json(
        createEmptyResponse({
          success: false,
          message: "Industry is required",
          errors: [{ stage: "validation", message: "Industry is required" }],
        }),
      );
    }

    console.log(`[OmniEngine] ═══ STARTING 4-PHASE PIPELINE ═══ ${industry} in ${location} limit=${limit} strict=${strictEmailFilter}`);

    const mapResults = await mapsSearch(industry, location, limit);
    if (mapResults.length === 0) {
      return json(createEmptyResponse({ message: "No businesses found" }));
    }

    const preparedLeads: PreparedLead[] = [];
    const discardedNames: string[] = [];
    const errors: Array<{ stage: string; business_name?: string; message: string }> = [];
    let failedCount = 0;

    for (const chunk of chunkArray(mapResults, CHUNK_SIZE)) {
      const settledChunk = await Promise.allSettled(
        chunk.map((business) =>
          processBusiness(business, industry, location, strictEmailFilter, allowEmailGuess),
        ),
      );

      settledChunk.forEach((settled, index) => {
        const businessName = chunk[index]?.title || "Unknown";
        if (settled.status === "rejected") {
          failedCount += 1;
          errors.push({
            stage: "prepare",
            business_name: businessName,
            message: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
          });
          return;
        }

        const result = settled.value;
        if (result.kind === "ready") {
          preparedLeads.push(result.lead);
          return;
        }

        if (result.kind === "discarded") {
          discardedNames.push(result.business_name);
          return;
        }

        failedCount += 1;
        errors.push({ stage: "prepare", business_name: result.business_name, message: result.error });
      });

      await sleep(150);
    }

    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const savedLeads: PreparedLead[] = [];
    let dripTriggered = 0;

    for (const chunk of chunkArray(preparedLeads, CHUNK_SIZE)) {
      const settledSaves = await Promise.allSettled(chunk.map((lead) => saveLead(serviceClient, lead)));

      settledSaves.forEach((settled, index) => {
        const businessName = chunk[index]?.business_name || "Unknown";
        if (settled.status === "rejected") {
          failedCount += 1;
          errors.push({
            stage: "save",
            business_name: businessName,
            message: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
          });
          return;
        }

        const result = settled.value;
        if (result.kind === "failed") {
          failedCount += 1;
          errors.push({ stage: "save", business_name: result.business_name, message: result.error });
          return;
        }

        savedLeads.push(result.lead);
        if (result.dripTriggered) dripTriggered += 1;
      });

      await sleep(150);
    }

    const withEmail = savedLeads.filter((l) => l.email).length;
    const withoutEmail = savedLeads.filter((l) => !l.email).length;

    const response = createEmptyResponse({
      total: mapResults.length,
      processed: savedLeads.length + discardedNames.length + failedCount,
      saved: savedLeads.length,
      discarded: discardedNames.length,
      failed: failedCount,
      discarded_names: discardedNames,
      successful_leads: savedLeads,
      results: savedLeads,
      drip_triggered: dripTriggered,
      with_email: withEmail,
      without_email: withoutEmail,
      errors,
    });

    console.log(`[OmniEngine] ═══ COMPLETE ═══ saved=${response.saved} (email=${withEmail}, no_email=${withoutEmail}) discarded=${response.discarded} failed=${response.failed} drips=${dripTriggered}`);
    return json(response);
  } catch (error) {
    console.error("[OmniEngine] Fatal error:", error);
    return json(
      createEmptyResponse({
        success: false,
        message: error instanceof Error ? error.message : "Engine failed",
        failed: 1,
        processed: 1,
        errors: [{ stage: "fatal", message: error instanceof Error ? error.message : String(error) }],
      }),
    );
  }
});
