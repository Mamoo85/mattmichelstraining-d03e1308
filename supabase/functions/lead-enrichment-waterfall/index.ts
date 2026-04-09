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

// ── CLAY.COM — Clay's public API uses tables/webhooks, not a REST enrichment endpoint.
// Use their "Enrich Person" via HTTP API pattern ──
async function clayEnrich(domain: string, businessName: string) {
  if (!CLAY_API_KEY || !domain) return null;
  try {
    // Clay's API works via table webhooks. Try their v1/sources endpoint
    const res = await fetch("https://api.clay.com/v1/sources", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_type: "api",
        domain,
        company_name: businessName,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      log("Clay error", { status: res.status, body: body.slice(0, 200) });
      return null;
    }
    const data = JSON.parse(body);
    const contact = data?.results?.[0] || data?.data?.[0];
    if (!contact) return null;
    return {
      email: contact.email || contact.work_email || "",
      phone: contact.phone || contact.direct_phone || "",
      name: contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || null,
      title: contact.title || contact.job_title || null,
      source: "clay",
    };
  } catch (e) { log("Clay exception", { error: String(e) }); return null; }
}

// ── DIRECT SCRAPE + LLM FALLBACK (no Firecrawl credits needed) ──
async function directScrapeLLMFallback(domain: string, businessName: string): Promise<{ email: string | null; name: string | null; title: string | null } | null> {
  try {
    const urls = [`https://${domain}`, `https://${domain}/contact`, `https://${domain}/about`, `https://www.${domain}`];
    let scrapedText = "";

    // First try Firecrawl if credits available
    if (FIRECRAWL_API_KEY) {
      for (const url of urls.slice(0, 2)) {
        try {
          const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 15000 }),
          });
          const body = await res.text();
          if (res.ok) {
            const data = JSON.parse(body);
            const md = data?.data?.markdown || "";
            if (md.length > 50) { scrapedText += md.slice(0, 3000); break; }
          } else if (res.status === 402) {
            log("Firecrawl credits exhausted, falling back to direct fetch");
            break;
          }
        } catch { /* continue */ }
      }
    }

    // Direct fetch fallback — works without any API
    if (scrapedText.length < 50) {
      log("Using direct fetch for scraping", { domain });
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; M2Bot/1.0)",
              "Accept": "text/html",
            },
            redirect: "follow",
          });
          if (!res.ok) { await res.text(); continue; }
          const html = await res.text();
          // Extract text content — strip tags, scripts, styles
          const cleaned = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (cleaned.length > 100) {
            scrapedText += `\n${cleaned.slice(0, 4000)}`;
            log("Direct fetch success", { url, contentLength: cleaned.length });
            if (scrapedText.length > 5000) break;
          }
        } catch (e) { log("Direct fetch failed", { url, error: String(e) }); }
      }
    }

    if (scrapedText.length < 50) { log("Scrape fallback — no usable content"); return null; }

    // Also try to find emails directly via regex before LLM
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = [...new Set(scrapedText.match(emailRegex) || [])];
    // Filter out common junk emails
    const junkPatterns = ["example.com", "sentry.io", "wixpress", "wordpress", "google.com", "facebook.com", "schema.org", "w3.org"];
    const cleanEmails = foundEmails.filter(e => !junkPatterns.some(j => e.includes(j)) && e.includes(domain));

    if (cleanEmails.length > 0) {
      log("Found email via regex in scraped content", { emails: cleanEmails });
      return { email: cleanEmails[0], name: null, title: null };
    }

    // If no emails found on the domain, try LLM extraction
    if (!LOVABLE_API_KEY) { log("LLM fallback skipped — no LOVABLE_API_KEY"); return null; }

    const prompt = `Extract the business owner or primary contact's email address, full name, and job title from this website content for "${businessName}" (domain: ${domain}).

Website content:
${scrapedText.slice(0, 4000)}

Respond with ONLY valid JSON:
{"email": "found@email.com or null", "name": "Full Name or null", "title": "Job Title or null"}`;

    const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!llmRes.ok) { const t = await llmRes.text(); log("LLM error", { status: llmRes.status, body: t.slice(0, 200) }); return null; }
    const llmData = await llmRes.json();
    const text = llmData?.choices?.[0]?.message?.content?.trim() || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (parsed.email && parsed.email !== "null" && parsed.email.includes("@")) {
      log("LLM extraction found", parsed);
      return { email: parsed.email, name: parsed.name === "null" ? null : parsed.name, title: parsed.title === "null" ? null : parsed.title };
    }

    // Check if LLM found any non-domain emails
    if (foundEmails.length > 0) {
      log("Using non-domain email from regex", { email: foundEmails[0] });
      return { email: foundEmails[0], name: null, title: null };
    }

    return null;
  } catch (e) { log("Scrape+LLM exception", { error: String(e) }); return null; }
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

async function runWaterfall(domain: string, businessName: string): Promise<EnrichmentResult> {
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
    log("Step 5: Firecrawl + LLM fallback", { domain, hunterRateLimited });
    const scraped = await firecrawlLLMFallback(domain, businessName);
    if (scraped?.email) {
      result.email = scraped.email;
      result.enrichment_source = "firecrawl_llm";
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
  if (!result.email) {
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
    const { prospect_id, domain, business_name, website, mode, industry } = body;

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
          const result = await runWaterfall(dom, prospect.business_name);
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
      for (const source of ["hunter", "apollo", "lusha", "clay", "firecrawl_llm", "email_guess"]) {
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

    const result = await runWaterfall(targetDomain, business_name || "");

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
