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
      return await apolloOrgEnrich(domain, businessName);
    }
    const data = JSON.parse(body);
    const person = data?.person;
    if (!person?.email) {
      return await apolloOrgEnrich(domain, businessName);
    }
    return {
      email: person.email,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || null,
      title: person.title || null,
      source: "apollo",
    };
  } catch (e) { log("Apollo exception", { error: String(e) }); return null; }
}

async function apolloOrgEnrich(domain: string, businessName: string) {
  if (!APOLLO_API_KEY || !domain) return null;
  try {
    const res = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
    });
    // Apollo org enrich uses query params
    const url = `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`;
    const res2 = await fetch(url, {
      headers: { "Cache-Control": "no-cache", "X-Api-Key": APOLLO_API_KEY },
    });
    const body = await res2.text();
    await res.text(); // consume first response
    if (!res2.ok) { log("Apollo org enrich error", { status: res2.status, body: body.slice(0, 200) }); return null; }
    const data = JSON.parse(body);
    const org = data?.organization;
    if (!org) return null;
    // Org enrich doesn't return emails directly but can give useful data
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

// ── JINA AI READER + STRICT XML LLM FALLBACK ──
const JINA_TIMEOUT_MS = 8000;
const JINA_PATHS = ["", "/contact", "/about"];

function normalizeWebsite(url: string): string {
  let clean = url.trim();
  if (!clean.startsWith("http")) clean = `https://${clean}`;
  return new URL(clean).toString();
}

async function fetchJinaMarkdown(targetUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: {
        "Accept": "text/markdown",
        "User-Agent": "Mozilla/5.0 (compatible; M2Bot/1.0)",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      log("Jina Reader non-ok", { url: targetUrl, status: res.status, body: body.slice(0, 120) });
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

async function extractLeadFromMarkdown(
  markdown: string,
  businessName: string,
  domain: string,
): Promise<{ email: string | null; name: string | null; title: string | null } | null> {
  if (!LOVABLE_API_KEY || !markdown.trim()) {
    log("LLM fallback skipped", { hasKey: !!LOVABLE_API_KEY, hasMarkdown: !!markdown.trim() });
    return null;
  }

  const emailCandidates = Array.from(
    new Set(markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []),
  ).slice(0, 10);

  const prompt = `<Role>
You are a precision B2B lead extraction engine.
</Role>

<Task>
Analyze the provided website markdown, identify the highest-value decision-maker, and extract or reconstruct their email address.
</Task>

<Rules_of_Engagement>
1. THE EMAIL MANDATE: An email address is the absolute primary key. If you cannot extract or definitively reconstruct a valid email address for a contact, you MUST return extraction_status="failed_no_email" with an empty leads array. System Flag: allow_no_email=false.
2. DEEP SEARCH TARGETING: Prioritize Owners, Founders, Presidents, Partners, and senior operators over generic inboxes.
3. OBFUSCATION BYPASS: Reconstruct hidden emails such as "name [at] company [dot] com".
4. DOMAIN SAFETY: Only return an email that clearly belongs to ${domain}.
5. GENERIC EMAIL RULE: A generic inbox may only be used if no named leader email exists and the inbox is clearly displayed on the site.
6. OUTPUT FORMAT: Return only valid minified JSON matching the schema.
</Rules_of_Engagement>

<Formatting_Schema>
{
  "extraction_status": "success" | "failed_no_email" | "no_data_found",
  "leads": [
    {
      "first_name": "string",
      "last_name": "string",
      "job_title": "string",
      "company_name": "string",
      "validated_email": "string",
      "phone_number": "string | null"
    }
  ]
}
</Formatting_Schema>

<Input>
Business Name: ${businessName}
Domain: ${domain}
System Flag: allow_no_email=false
Regex Candidates: ${emailCandidates.join(", ") || "none"}

--- WEBSITE MARKDOWN START ---
${markdown.slice(0, 12000)}
--- WEBSITE MARKDOWN END ---
</Input>`;

  const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!llmRes.ok) {
    const body = await llmRes.text();
    log("LLM error", { status: llmRes.status, body: body.slice(0, 200) });
    return null;
  }

  const llmData = await llmRes.json();
  const raw = llmData?.choices?.[0]?.message?.content?.trim() || "";
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    log("LLM returned no JSON", { preview: cleaned.slice(0, 160) });
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]);
    const lead = Array.isArray(parsed?.leads) ? parsed.leads.find((item: any) => item?.validated_email?.includes("@")) : null;
    if (!lead) {
      log("LLM found no valid email", { extraction_status: parsed?.extraction_status || null });
      return null;
    }

    return {
      email: lead.validated_email,
      name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
      title: lead.job_title || null,
    };
  } catch (e) {
    log("LLM JSON parse error", { error: String(e), preview: cleaned.slice(0, 160) });
    return null;
  }
}

async function directScrapeLLMFallback(
  websiteOrDomain: string,
  domain: string,
  businessName: string,
): Promise<{ email: string | null; name: string | null; title: string | null } | null> {
  try {
    const baseUrl = normalizeWebsite(websiteOrDomain || domain);
    const markdownParts: string[] = [];

    for (const path of JINA_PATHS) {
      const targetUrl = path ? new URL(path, baseUrl).toString() : baseUrl;
      const markdown = await fetchJinaMarkdown(targetUrl);
      if (markdown.length > 80) {
        markdownParts.push("--- " + targetUrl + " ---\n" + markdown.slice(0, 4000));
      }
    }

    const combinedMarkdown = markdownParts.join("\n\n").trim();
    if (!combinedMarkdown) {
      log("Jina fallback produced no markdown", { domain, businessName });
      return null;
    }

    const extracted = await extractLeadFromMarkdown(combinedMarkdown, businessName, domain);
    if (extracted?.email) {
      log("LLM extraction found from Jina markdown", extracted);
      return extracted;
    }

    return null;
  } catch (e) {
    log("Jina+LLM exception", { error: String(e) });
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

  // Step 4: Clay.com
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

  // Step 5: Firecrawl + LLM fallback (if all APIs failed or Hunter was rate-limited)
  if (!result.email) {
    log("Step 5: Direct scrape + LLM fallback", { domain, hunterRateLimited });
    const scraped = await directScrapeLLMFallback(options.website || `https://${domain}`, domain, businessName);
    if (scraped?.email) {
      result.email = scraped.email;
      result.enrichment_source = "direct_scrape";
      if (!result.decision_maker_name && scraped.name) result.decision_maker_name = scraped.name;
      if (!result.decision_maker_title && scraped.title) result.decision_maker_title = scraped.title;
      result.enrichment_data.firecrawl_llm = scraped;

      // Try to verify the scraped email
      if (HUNTER_API_KEY && !hunterRateLimited) {
        result.verified_email = await hunterVerify(scraped.email);
      }
      log("Firecrawl+LLM found", scraped);
    }
  }

  // Step 6: Email pattern guess (absolute last resort)
  if (!result.email && options.allowEmailGuess) {
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
    const { prospect_id, domain, business_name, businessName, website, mode, industry, allow_email_guess = false } = body;
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
        return new Response(JSON.stringify({ ok: true, enriched: 0, message: "No pending prospects" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let enriched = 0, failed = 0;
      for (const prospect of pending) {
        try {
          const dom = extractDomain(prospect.website || "");
          if (!dom) { failed++; continue; }
          const result = await runWaterfall(dom, prospect.business_name, { website: prospect.website, allowEmailGuess: false });
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
    const targetDomain = domain || (website ? extractDomain(website) : "");
    if (!targetDomain) {
      return new Response(JSON.stringify({ error: "domain or website required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await runWaterfall(targetDomain, resolvedBusinessName, { website, allowEmailGuess: Boolean(allow_email_guess) });

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
