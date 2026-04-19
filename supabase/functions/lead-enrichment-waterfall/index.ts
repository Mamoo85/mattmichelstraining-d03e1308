import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const LUSHA_API_KEY = Deno.env.get("LUSHA_API_KEY") || "";
const CLAY_API_KEY = Deno.env.get("CLAY_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[ENRICH] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── HUNTER.IO ──
async function hunterSearch(domain: string) {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=5`);
    const body = await res.text();
    if (!res.ok) {
      log("Hunter error", { status: res.status, body: body.slice(0, 200) });
      if (res.status === 429) return { _rateLimited: true } as any;
      return null;
    }
    const data = JSON.parse(body);
    const emails = data?.data?.emails || [];
    if (emails.length === 0) return null;
    const personal = emails.find((e: any) => e.type === "personal" && e.confidence >= 50);
    const best = personal || emails[0];
    return {
      email: best.value,
      name: `${best.first_name || ""} ${best.last_name || ""}`.trim() || null,
      title: best.position || null,
      confidence: best.confidence || 0,
      source: "hunter",
    };
  } catch (e) { log("Hunter exception", { error: String(e) }); return null; }
}

async function hunterVerify(email: string): Promise<boolean> {
  if (!HUNTER_API_KEY || !email) return false;
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`);
    if (!res.ok) { await res.text(); return false; }
    const data = await res.json();
    const result = data?.data?.result;
    return result === "deliverable" || result === "risky";
  } catch { return false; }
}

// ── APOLLO.IO — use /v1/people/match (enrichment, works on free tier) ──
async function apolloSearch(domain: string, businessName: string) {
  if (!APOLLO_API_KEY || !domain) return null;
  try {
    // Use the people/match enrichment endpoint (free-tier accessible)
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        organization_name: businessName,
        domain: domain,
        reveal_personal_emails: false,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      log("Apollo people/match error", { status: res.status, body: body.slice(0, 200) });
      // Fallback: try organization enrich for company-level data
      return await apolloOrgEnrich(domain);
    }
    const data = JSON.parse(body);
    const person = data?.person;
    if (!person?.email) {
      return await apolloOrgEnrich(domain);
    }
    return {
      email: person.email,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || null,
      title: person.title || null,
      source: "apollo",
    };
  } catch (e) { log("Apollo exception", { error: String(e) }); return null; }
}

// Apollo org enrich — only returns company metadata, never email
async function apolloOrgEnrich(domain: string) {
  if (!APOLLO_API_KEY || !domain) return null;
  try {
    const url = `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      headers: { "Cache-Control": "no-cache", "X-Api-Key": APOLLO_API_KEY },
    });
    const body = await res.text();
    if (!res.ok) { log("Apollo org enrich error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const org = data?.organization;
    if (!org) return null;
    // Org enrich doesn't return emails — only useful for phone/company metadata
    return {
      email: null,
      name: null,
      title: null,
      phone: org.phone || null,
      source: "apollo_org",
      orgData: { name: org.name, industry: org.industry, employees: org.estimated_num_employees },
    };
  } catch (e) { log("Apollo org exception", { error: String(e) }); return null; }
}

// ── LUSHA — correct v2 API: GET /v2/person with query params ──
async function lushaSearch(domain: string, businessName: string) {
  if (!LUSHA_API_KEY || !domain) return null;
  try {
    // Lusha v2 person endpoint uses GET with query params
    const url = `https://api.lusha.com/v2/person?companyDomain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "api_key": LUSHA_API_KEY,
        "Accept": "application/json",
      },
    });
    const body = await res.text();
    if (!res.ok) {
      log("Lusha error", { status: res.status, body: body.slice(0, 200) });
      // Try company endpoint as fallback
      return await lushaCompany(domain);
    }
    const data = JSON.parse(body);
    const contact = data?.data || data;
    if (!contact) return null;
    // Handle both single and array responses
    const person = Array.isArray(contact) ? contact[0] : contact;
    if (!person) return null;
    return {
      email: person.emailAddresses?.[0]?.value || person.email_address || person.email || "",
      phone: person.phoneNumbers?.[0]?.value || person.phone_number || person.phone || "",
      name: person.fullName || person.full_name || `${person.firstName || ""} ${person.lastName || ""}`.trim() || null,
      title: person.jobTitle || person.job_title || person.title || null,
      source: "lusha",
    };
  } catch (e) { log("Lusha exception", { error: String(e) }); return null; }
}

async function lushaCompany(domain: string) {
  if (!LUSHA_API_KEY || !domain) return null;
  try {
    const url = `https://api.lusha.com/v2/company?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "api_key": LUSHA_API_KEY, "Accept": "application/json" },
    });
    const body = await res.text();
    if (!res.ok) { log("Lusha company error", { status: res.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const company = data?.data || data;
    if (!company) return null;
    return {
      email: null,
      phone: company.phone || company.phoneNumber || "",
      name: null,
      title: null,
      source: "lusha_company",
    };
  } catch (e) { log("Lusha company exception", { error: String(e) }); return null; }
}

// ── CLAY.COM — API deprecated as of 2026. Disabled to save time. ──
async function clayEnrich(_domain: string, _businessName: string) {
  log("Clay skipped — API deprecated");
  return null;
}

// ── FIRECRAWL PRIMARY + JINA FALLBACK + PRO LLM EXTRACTION ──
const JINA_TIMEOUT_MS = 15000;
const FIRECRAWL_TIMEOUT_MS = 20000;
const SCRAPE_PATHS = ["", "/contact", "/about", "/team", "/our-team", "/staff", "/people", "/about-us", "/leadership", "/management"];

function normalizeWebsite(url: string): string {
  let clean = url.trim();
  if (!clean.startsWith("http")) clean = `https://${clean}`;
  return new URL(clean).toString();
}

// ── FIRECRAWL SCRAPER (Primary — best JS rendering + anti-bot bypass) ──
async function fetchFirecrawlMarkdown(targetUrl: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      log("Firecrawl non-ok", { url: targetUrl, status: res.status, body: body.slice(0, 120) });
      return res.status === 402 ? "__402__" : "";
    }
    const data = await res.json();
    return data?.data?.markdown || data?.markdown || "";
  } catch (e) {
    log("Firecrawl error", { url: targetUrl, error: String(e) });
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── JINA AI READER (Fallback — free, no API key needed) ──
async function fetchJinaMarkdown(targetUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: {
        Accept: "text/markdown",
        "User-Agent": "Mozilla/5.0 (compatible; M2Bot/1.0)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      await res.text();
      return "";
    }
    return await res.text();
  } catch (e) {
    log("Jina Reader error", { url: targetUrl, error: String(e) });
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── MULTI-PAGE SCRAPER: tries Firecrawl first, falls back to Jina ──
async function scrapeMultiplePages(
  websiteOrDomain: string,
  domain: string,
): Promise<string> {
  const baseUrl = normalizeWebsite(websiteOrDomain || domain);
  const markdownParts: string[] = [];
  let firecrawlExhausted = false; // Short-circuit if credits are gone

  for (const path of SCRAPE_PATHS) {
    const targetUrl = path ? new URL(path, baseUrl).toString() : baseUrl;

    let markdown = "";

    // Try Firecrawl first (primary) — skip if credits exhausted
    if (!firecrawlExhausted) {
      markdown = await fetchFirecrawlMarkdown(targetUrl);
      if (markdown === "__402__") {
        firecrawlExhausted = true;
        markdown = "";
        log("Firecrawl credits exhausted, switching to Jina-only", {});
      }
    }

    // Fallback to Jina
    if (markdown.length < 80) {
      markdown = await fetchJinaMarkdown(targetUrl);
    }

    if (markdown.length > 80) {
      markdownParts.push("--- " + targetUrl + " ---\n" + markdown.slice(0, 5000));
    }

    // If we already have substantial content, don't burn time on all pages
    if (markdownParts.length >= 3) break;
  }

  return markdownParts.join("\n\n").trim();
}

// ── PRO LLM EXTRACTION (gemini-2.5-pro — our secret weapon) ──
async function extractLeadFromMarkdown(
  markdown: string,
  businessName: string,
  domain: string,
): Promise<{ email: string | null; name: string | null; title: string | null; phone: string | null } | null> {
  if (!LOVABLE_API_KEY || !markdown.trim()) return null;

  const emailCandidates = Array.from(
    new Set(markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []),
  ).slice(0, 15);

  const phoneCandidates = Array.from(
    new Set(markdown.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []),
  ).slice(0, 8);

  const prompt = `<Role>
You are a world-class B2B intelligence extraction engine. You find decision-makers that other tools miss.
</Role>

<Task>
Analyze the provided website content for "${businessName}" (domain: ${domain}).
Find the highest-authority decision-maker and extract their complete contact information.
</Task>

<Advanced_Extraction_Rules>
1. DEEP PATTERN MATCHING: Look for email patterns like firstname@, first.last@, initials@, even in mailto: links, JavaScript, or obfuscated formats like "name [at] domain [dot] com" or "name(at)domain.com".
2. EMAIL RECONSTRUCTION: If you find a person's name but no direct email, RECONSTRUCT it using common patterns: first@${domain}, first.last@${domain}, firstlast@${domain}, f.last@${domain}.
3. PHONE INTELLIGENCE: Extract direct lines, cell phones, and office numbers. Prefer direct/cell over main office lines.
4. TITLE HIERARCHY: Owner > Founder > CEO > President > Partner > Managing Director > VP > Director > Manager. Skip receptionists, assistants, and junior staff.
5. CONTACT PAGE PRIORITY: If you see a contact form email or general inbox AND a named person's email, ALWAYS prefer the named person.
6. HIDDEN SIGNALS: Check for "Meet the Team", "Our Staff", "About the Owner", staff bios, LinkedIn links, or footer contact info.
7. DOMAIN VALIDATION: The email MUST use ${domain} — reject emails from gmail.com, yahoo.com, etc.
8. CONFIDENCE: If you find a name and can reconstruct email@${domain}, DO IT. A reconstructed email > no email.
</Advanced_Extraction_Rules>

<Output_Schema>
{
  "extraction_status": "success" | "failed_no_email" | "no_data_found",
  "confidence": "high" | "medium" | "low",
  "leads": [
    {
      "first_name": "string",
      "last_name": "string",
      "job_title": "string",
      "company_name": "string",
      "validated_email": "string",
      "phone_number": "string | null",
      "email_source": "found_on_page" | "reconstructed" | "mailto_link"
    }
  ]
}
</Output_Schema>

<Input>
Business Name: ${businessName}
Domain: ${domain}
Email Candidates Found by Regex: ${emailCandidates.join(", ") || "none"}
Phone Candidates Found by Regex: ${phoneCandidates.join(", ") || "none"}

--- WEBSITE CONTENT START ---
${markdown.slice(0, 15000)}
--- WEBSITE CONTENT END ---
</Input>

Return ONLY valid minified JSON. No markdown fences.`;

  const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!llmRes.ok) {
    const body = await llmRes.text();
    log("Pro LLM error", { status: llmRes.status, body: body.slice(0, 200) });
    return null;
  }

  const llmData = await llmRes.json();
  const raw = llmData?.choices?.[0]?.message?.content?.trim() || "";
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    log("Pro LLM returned no JSON", { preview: cleaned.slice(0, 160) });
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]);
    const lead = Array.isArray(parsed?.leads) ? parsed.leads.find((item: any) => item?.validated_email?.includes("@")) : null;
    if (!lead) {
      log("Pro LLM found no valid email", { extraction_status: parsed?.extraction_status || null });
      return null;
    }

    log("Pro LLM extraction success", { email: lead.validated_email, confidence: parsed.confidence, source: lead.email_source });
    return {
      email: lead.validated_email,
      name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
      title: lead.job_title || null,
      phone: lead.phone_number || null,
    };
  } catch (e) {
    log("Pro LLM JSON parse error", { error: String(e), preview: cleaned.slice(0, 160) });
    return null;
  }
}

// ── COMBINED SCRAPE + LLM PIPELINE ──
async function directScrapeLLMFallback(
  websiteOrDomain: string,
  domain: string,
  businessName: string,
): Promise<{ email: string | null; name: string | null; title: string | null; phone?: string | null } | null> {
  try {
    const combinedMarkdown = await scrapeMultiplePages(websiteOrDomain, domain);
    if (!combinedMarkdown) {
      log("All scrapers returned empty", { domain, businessName });
      return null;
    }

    const extracted = await extractLeadFromMarkdown(combinedMarkdown, businessName, domain);
    if (extracted?.email) {
      log("Firecrawl+Pro LLM extraction found", extracted);
      return extracted;
    }

    return null;
  } catch (e) {
    log("Scrape+LLM exception", { error: String(e) });
    return null;
  }
}

// ── Email Pattern Guess (last resort) ──
async function guessEmail(domain: string, name: string | null): Promise<string | null> {
  if (!domain) return null;

  const candidates: string[] = [];
  if (name) {
    const parts = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const last = parts[parts.length - 1] || "";
    if (first && last && first !== last) {
      candidates.push(`${first}@${domain}`, `${first}.${last}@${domain}`, `${first}${last}@${domain}`, `${first[0]}${last}@${domain}`);
    } else if (first) {
      candidates.push(`${first}@${domain}`);
    }
  }
  candidates.push(`info@${domain}`, `contact@${domain}`, `hello@${domain}`, `office@${domain}`);

  if (HUNTER_API_KEY) {
    for (const email of candidates.slice(0, 4)) {
      const verified = await hunterVerify(email);
      if (verified) {
        log("Email pattern verified via Hunter", { email });
        return email;
      }
    }
  }

  // Return best guess unverified
  const bestGuess = `info@${domain}`;
  log("Email pattern guess (unverified)", { email: bestGuess });
  return bestGuess;
}

function extractDomain(url: string): string {
  try {
    let clean = url.trim();
    if (!clean.startsWith("http")) clean = `https://${clean}`;
    return new URL(clean).hostname.replace("www.", "");
  } catch { return ""; }
}

interface EnrichmentResult {
  email: string | null;
  verified_email: boolean;
  decision_maker_name: string | null;
  decision_maker_title: string | null;
  direct_phone: string | null;
  enrichment_source: string;
  enrichment_data: Record<string, any>;
}

async function runWaterfall(domain: string, businessName: string, options: { website?: string | null; allowEmailGuess?: boolean } = {}): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    email: null, verified_email: false, decision_maker_name: null,
    decision_maker_title: null, direct_phone: null, enrichment_source: "none",
    enrichment_data: {},
  };
  let hunterRateLimited = false;

  // Step 1: Hunter.io
  log("Step 1: Hunter.io", { domain });
  const hunterResult = await hunterSearch(domain);
  if (hunterResult?._rateLimited) {
    hunterRateLimited = true;
    log("Hunter rate-limited, skipping to next provider");
  } else if (hunterResult?.email) {
    result.email = hunterResult.email;
    result.enrichment_source = "hunter";
    result.decision_maker_name = hunterResult.name;
    result.decision_maker_title = hunterResult.title;
    result.enrichment_data.hunter = hunterResult;
    const verified = await hunterVerify(hunterResult.email);
    result.verified_email = verified;
    log("Hunter found", { email: hunterResult.email, verified });
  }

  // Step 2: Apollo.io (using /v1/people/match — free-tier accessible)
  if (!result.email || !result.decision_maker_name) {
    log("Step 2: Apollo.io", { domain });
    const apolloResult = await apolloSearch(domain, businessName);
    if (apolloResult) {
      if (!result.email && apolloResult.email) { result.email = apolloResult.email; result.enrichment_source = "apollo"; }
      if (!result.decision_maker_name && apolloResult.name) result.decision_maker_name = apolloResult.name;
      if (!result.decision_maker_title && apolloResult.title) result.decision_maker_title = apolloResult.title;
      if ((apolloResult as any).phone && !result.direct_phone) result.direct_phone = (apolloResult as any).phone;
      result.enrichment_data.apollo = apolloResult;
      log("Apollo found", apolloResult);
    }
  }

  // Step 3: Lusha (using GET /v2/person — correct endpoint)
  if (!result.direct_phone || !result.email) {
    log("Step 3: Lusha", { domain });
    const lushaResult = await lushaSearch(domain, businessName);
    if (lushaResult) {
      if (lushaResult.phone) result.direct_phone = lushaResult.phone;
      if (!result.email && lushaResult.email) { result.email = lushaResult.email; result.enrichment_source = "lusha"; }
      if (!result.decision_maker_name && lushaResult.name) result.decision_maker_name = lushaResult.name;
      if (!result.decision_maker_title && lushaResult.title) result.decision_maker_title = lushaResult.title;
      result.enrichment_data.lusha = lushaResult;
      log("Lusha found", lushaResult);
    }
  }

  // Step 4: Clay.com (disabled — API deprecated)
  if (!result.email || !result.direct_phone) {
    log("Step 4: Clay.com", { domain });
    const clayResult = await clayEnrich(domain, businessName);
    if (clayResult) {
      if (!result.email && clayResult.email) { result.email = clayResult.email; result.enrichment_source = "clay"; }
      if (!result.direct_phone && clayResult.phone) result.direct_phone = clayResult.phone;
      if (!result.decision_maker_name && clayResult.name) result.decision_maker_name = clayResult.name;
      if (!result.decision_maker_title && clayResult.title) result.decision_maker_title = clayResult.title;
      result.enrichment_data.clay = clayResult;
      log("Clay found", clayResult);
    }
  }

  // Step 5: Firecrawl (primary) + Jina (fallback) + gemini-2.5-pro LLM extraction
  if (!result.email) {
    log("Step 5: Firecrawl+Jina scrape + Pro LLM extraction", { domain, hunterRateLimited });
    const scraped = await directScrapeLLMFallback(options.website || `https://${domain}`, domain, businessName);
    if (scraped?.email) {
      result.email = scraped.email;
      result.enrichment_source = "firecrawl_pro";
      if (!result.decision_maker_name && scraped.name) result.decision_maker_name = scraped.name;
      if (!result.decision_maker_title && scraped.title) result.decision_maker_title = scraped.title;
      if (!result.direct_phone && scraped.phone) result.direct_phone = scraped.phone;
      result.enrichment_data.firecrawl_pro = scraped;

      // Try to verify the scraped email
      if (HUNTER_API_KEY && !hunterRateLimited) {
        result.verified_email = await hunterVerify(scraped.email);
      }
      log("Firecrawl+Pro found", scraped);
    }
  }

  // Step 6: Email pattern guess (absolute last resort — enabled by default)
  if (!result.email && options.allowEmailGuess !== false) {
    log("Step 6: Email guess fallback", { domain, name: result.decision_maker_name });
    const guessed = await guessEmail(domain, result.decision_maker_name);
    if (guessed) {
      result.email = guessed;
      result.enrichment_source = "email_guess";
      log("Fallback email found", { email: guessed });
    }
  }

  log("Waterfall complete", { email: result.email, source: result.enrichment_source, name: result.decision_maker_name });
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prospect_id, domain, business_name, businessName, website, mode, industry, allow_email_guess } = body;
    // Default allow_email_guess to true — guess info@/contact@ as last resort
    const allowEmailGuessResolved = allow_email_guess !== false;
    const resolvedBusinessName = business_name || businessName || "";

    // ── BATCH MODE ──
    if (mode === "batch") {
      const batchLimit = body.limit || 20;
      const { data: pending } = await sb
        .from("prospect_businesses")
        .select("id, business_name, website, email")
        .or("enrichment_status.eq.pending,enrichment_status.is.null")
        .not("website", "is", null)
        .order("created_at", { ascending: false })
        .limit(batchLimit);

      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ ok: true, enriched: 0, total: 0, message: "No pending prospects" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let enriched = 0, failed = 0;
      for (const prospect of pending) {
        try {
          const dom = extractDomain(prospect.website || "");
          if (!dom) { failed++; continue; }
          // Enable email guessing in batch mode — maximize leads found
          const result = await runWaterfall(dom, prospect.business_name, { website: prospect.website, allowEmailGuess: true });
          await sb.from("prospect_businesses").update({
            enrichment_source: result.enrichment_source,
            enrichment_status: result.email ? "enriched" : "no_data",
            verified_email: result.verified_email,
            decision_maker_name: result.decision_maker_name,
            decision_maker_title: result.decision_maker_title,
            direct_phone: result.direct_phone,
            enriched_at: new Date().toISOString(),
            enrichment_data: result.enrichment_data,
            ...(result.email && !prospect.email ? { email: result.email } : {}),
          }).eq("id", prospect.id);
          enriched++;
          await new Promise(r => setTimeout(r, 500));
        } catch (e) { log("Batch error", { id: prospect.id, error: String(e) }); failed++; }
      }

      return new Response(JSON.stringify({ ok: true, enriched, failed, total: pending.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATS MODE ──
    if (mode === "stats") {
      const [t, e, p, n] = await Promise.all([
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "enriched"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).or("enrichment_status.eq.pending,enrichment_status.is.null"),
        sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_status", "no_data"),
      ]);
      const sourceBreakdown: Record<string, number> = {};
      for (const source of ["hunter", "apollo", "lusha", "clay", "direct_scrape", "firecrawl_llm", "email_guess"]) {
        const { count } = await sb.from("prospect_businesses").select("id", { count: "exact", head: true }).eq("enrichment_source", source);
        sourceBreakdown[source] = count || 0;
      }
      return new Response(JSON.stringify({
        ok: true, total: t.count || 0, enriched: e.count || 0, pending: p.count || 0,
        no_data: n.count || 0, by_source: sourceBreakdown,
        apis_configured: { hunter: !!HUNTER_API_KEY, apollo: !!APOLLO_API_KEY, lusha: !!LUSHA_API_KEY, clay: !!CLAY_API_KEY, firecrawl: !!FIRECRAWL_API_KEY },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SINGLE ENRICHMENT MODE (called by omni-lead-engine) ──
    // Guard: if domain/website weren't supplied (e.g. admin button with no body), don't error — return stats.
    if (!domain && !website) {
      const [t, e, p, n] = await Promise.all([
        sb.from("prospect_businesses").select("id", { head: true, count: "exact" }),
        sb.from("prospect_businesses").select("id", { head: true, count: "exact" }).eq("enrichment_status", "enriched"),
        sb.from("prospect_businesses").select("id", { head: true, count: "exact" }).eq("enrichment_status", "pending"),
        sb.from("prospect_businesses").select("id", { head: true, count: "exact" }).eq("enrichment_status", "no_data"),
      ]);
      return new Response(JSON.stringify({
        ok: true, message: "No prospects passed — returning stats. Pass {domain} or {website} to enrich a single record.",
        total: t.count || 0, enriched: e.count || 0, pending: p.count || 0, no_data: n.count || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const targetDomain = domain || (website ? extractDomain(website) : "");
    if (!targetDomain) {
      return new Response(JSON.stringify({ error: "domain or website required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await runWaterfall(targetDomain, resolvedBusinessName, { website, allowEmailGuess: allowEmailGuessResolved });

    if (prospect_id) {
      await sb.from("prospect_businesses").update({
        enrichment_source: result.enrichment_source,
        enrichment_status: result.email ? "enriched" : "no_data",
        verified_email: result.verified_email,
        decision_maker_name: result.decision_maker_name,
        decision_maker_title: result.decision_maker_title,
        direct_phone: result.direct_phone,
        enriched_at: new Date().toISOString(),
        enrichment_data: result.enrichment_data,
        ...(result.email ? { email: result.email } : {}),
      }).eq("id", prospect_id);
    }

    return new Response(JSON.stringify({
      ok: true,
      email: result.email,
      verified_email: result.verified_email,
      contact_name: result.decision_maker_name,
      decision_maker_name: result.decision_maker_name,
      decision_maker_title: result.decision_maker_title,
      direct_phone: result.direct_phone,
      phone: result.direct_phone,
      enrichment_source: result.enrichment_source,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ENRICH]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: corsHeaders });
  }
});
