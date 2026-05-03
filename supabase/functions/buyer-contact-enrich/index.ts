// buyer-contact-enrich — 8-stage decision-maker waterfall
//
// POST { buyer_id, force?: boolean, max_per_buyer?: number }
// → { ok, contacts: [{ ... }], trace: [{ stage, status, count, ms }] }
//
// Order: cache → Apollo → Snov → Hunter → PDL → pattern verify → site_scrape → manual stub.
// Each stage stops the waterfall as soon as we have N verified contacts (default 3).
// Whether stage hit or miss, every step is logged into the contact's meta.enrichment_trace
// per the project's Unified Enrichment Waterfall core rule.
//
// Graceful degradation: any missing API key just demotes that stage to skipped.
// Pattern-verify + site_scrape always run as last-resort fallbacks so the engine
// never returns zero contacts when a website domain can be inferred.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, extractDomain, seniorityScore } from "../_shared/coldEmailShared.ts";
import { isAggregatorDomain, isEnterprise, googlePlacesWebsite, cleanWebsite } from "../_shared/enrichment-pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const SNOV_CLIENT_ID = Deno.env.get("SNOV_CLIENT_ID") || "";
const SNOV_CLIENT_SECRET = Deno.env.get("SNOV_CLIENT_SECRET") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_IO_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const TARGET_TITLES = [
  "Branch Manager", "Purchasing Manager", "Operations Manager",
  "Buyer", "Owner", "President", "GM", "General Manager", "VP Operations",
];

interface Contact {
  full_name: string;
  first_name?: string;
  title?: string;
  email?: string;
  email_verified?: boolean;
  email_source: string;
  email_confidence: number;
  linkedin_url?: string;
  phone?: string;
  seniority?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { buyer_id, force = false, max_per_buyer = 3 } = await req.json().catch(() => ({}));
    if (!buyer_id) return json({ error: "buyer_id required" }, 400);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: buyer, error: bErr } = await sb
      .from("industrial_supply_buyers")
      .select("id, company, vertical, email, website, city, state")
      .eq("id", buyer_id)
      .maybeSingle();
    if (bErr) throw new Error(`buyer fetch: ${bErr.message}`);
    if (!buyer) return json({ error: "buyer not found" }, 404);

    // Cache stage
    if (!force) {
      const { data: cached } = await sb
        .from("buyer_contacts")
        .select("*")
        .eq("buyer_id", buyer_id)
        .gte("enriched_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
        .order("email_confidence", { ascending: false })
        .limit(max_per_buyer);
      if (cached && cached.length >= 1) {
        return json({ ok: true, source: "cache", contacts: cached, trace: [{ stage: "cache", status: "hit", count: cached.length, ms: 0 }] });
      }
    }

    const trace: { stage: string; status: string; count: number; ms: number; error?: string }[] = [];
    const collected: Contact[] = [];
    const domain = extractDomain(buyer.website || buyer.email);

    async function runStage(name: string, fn: () => Promise<Contact[]>) {
      if (collected.length >= max_per_buyer) return;
      const t0 = Date.now();
      try {
        const out = await fn();
        const ms = Date.now() - t0;
        // dedupe by lower(email) or lower(name)
        for (const c of out) {
          if (collected.length >= max_per_buyer) break;
          const k = (c.email || c.full_name).toLowerCase();
          if (!collected.some((x) => (x.email || x.full_name).toLowerCase() === k)) {
            collected.push(c);
          }
        }
        trace.push({ stage: name, status: out.length ? "hit" : "miss", count: out.length, ms });
      } catch (e: any) {
        trace.push({ stage: name, status: "error", count: 0, ms: Date.now() - t0, error: e?.message || String(e) });
      }
    }

    await runStage("apollo", () => apolloPeople(buyer.company, buyer.city, domain));
    await runStage("snov",   () => snovDomainSearch(domain));
    await runStage("hunter", () => hunterDomainSearch(domain));
    await runStage("pdl",    () => pdlPeople(buyer.company, domain));
    await runStage("pattern_verify", () => patternVerify(buyer.company, domain));
    await runStage("site_scrape",    () => siteScrape(buyer.company, buyer.website || (domain ? `https://${domain}` : null)));
    if (collected.length === 0) {
      trace.push({ stage: "manual_stub", status: "fallback", count: 1, ms: 0 });
      collected.push({
        full_name: `${buyer.company} — Decision Maker`,
        title: "Manual lookup required",
        email: domain ? `info@${domain}` : (buyer.email || ""),
        email_source: "manual",
        email_confidence: 10,
        seniority: "unknown",
      });
    }

    // Persist
    const rows = collected.map((c, idx) => ({
      buyer_id,
      full_name: c.full_name,
      first_name: c.first_name || c.full_name.split(" ")[0],
      title: c.title,
      seniority: c.seniority || tellSeniority(c.title),
      email: c.email?.toLowerCase() || null,
      email_verified: !!c.email_verified,
      email_source: c.email_source,
      email_confidence: c.email_confidence,
      linkedin_url: c.linkedin_url || null,
      phone: c.phone || null,
      is_primary: idx === 0,
      enriched_at: new Date().toISOString(),
      refreshed_at: new Date().toISOString(),
      meta: { enrichment_trace: trace },
    }));

    const { data: persisted, error: insErr } = await sb
      .from("buyer_contacts")
      .upsert(rows, { onConflict: "buyer_id,email", ignoreDuplicates: false })
      .select("*");
    if (insErr) {
      // Some rows may have null emails — fall back to plain insert for those
      console.error("[buyer-contact-enrich] upsert err, falling back", insErr.message);
      const { data: ins2 } = await sb.from("buyer_contacts").insert(rows).select("*");
      return json({ ok: true, source: "waterfall", contacts: ins2 || rows, trace });
    }

    return json({ ok: true, source: "waterfall", contacts: persisted || rows, trace });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[buyer-contact-enrich]", msg);
    return json({ error: msg }, 500);
  }
});

function tellSeniority(title?: string): string {
  if (!title) return "unknown";
  const t = title.toLowerCase();
  if (/owner|president|ceo/.test(t)) return "owner";
  if (/vp|vice president/.test(t)) return "vp";
  if (/director/.test(t)) return "director";
  if (/manager|mgr|gm|general manager/.test(t)) return "manager";
  if (/buyer|purchasing|procurement/.test(t)) return "buyer";
  return "other";
}

// ─────────── stage implementations ───────────

async function apolloPeople(company: string, city: string | null, domain: string | null): Promise<Contact[]> {
  if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY missing");
  const r = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": APOLLO_API_KEY },
    body: JSON.stringify({
      q_organization_name: company,
      person_titles: TARGET_TITLES,
      organization_locations: city ? [city] : undefined,
      page: 1, per_page: 5,
    }),
  });
  if (!r.ok) throw new Error(`apollo ${r.status}`);
  const j = await r.json();
  const people = j?.people || [];
  return people.map((p: any) => ({
    full_name: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
    first_name: p.first_name,
    title: p.title,
    email: p.email || (p.email_status === "verified" ? p.email : undefined),
    email_verified: p.email_status === "verified",
    email_source: "apollo",
    email_confidence: p.email_status === "verified" ? 95 : (p.email ? 70 : 0),
    linkedin_url: p.linkedin_url,
    seniority: p.seniority,
  })).filter((c: Contact) => c.full_name);
}

async function snovDomainSearch(domain: string | null): Promise<Contact[]> {
  if (!domain) throw new Error("no domain");
  if (!SNOV_CLIENT_ID || !SNOV_CLIENT_SECRET) throw new Error("SNOV creds missing");
  // 1. Get OAuth token
  const tokRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SNOV_CLIENT_ID,
      client_secret: SNOV_CLIENT_SECRET,
    }),
  });
  if (!tokRes.ok) throw new Error(`snov auth ${tokRes.status}`);
  const tok = (await tokRes.json())?.access_token;
  if (!tok) throw new Error("snov no token");
  // 2. Domain search
  const r = await fetch("https://api.snov.io/v2/domain-emails-with-info", {
    method: "POST",
    headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ domain, type: "all", limit: 10 }),
  });
  if (!r.ok) throw new Error(`snov ${r.status}`);
  const j = await r.json();
  const emails = j?.emails || [];
  return emails.slice(0, 5).map((e: any) => ({
    full_name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email,
    first_name: e.firstName,
    title: e.position,
    email: e.email,
    email_verified: e.emailStatus === "valid",
    email_source: "snov",
    email_confidence: e.emailStatus === "valid" ? 90 : 60,
  })).filter((c: Contact) => c.email);
}

async function hunterDomainSearch(domain: string | null): Promise<Contact[]> {
  if (!domain) throw new Error("no domain");
  if (!HUNTER_API_KEY) throw new Error("HUNTER_API_KEY missing");
  const u = new URL("https://api.hunter.io/v2/domain-search");
  u.searchParams.set("domain", domain);
  u.searchParams.set("api_key", HUNTER_API_KEY);
  u.searchParams.set("limit", "10");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`hunter ${r.status}`);
  const j = await r.json();
  const emails = j?.data?.emails || [];
  return emails.slice(0, 5).map((e: any) => ({
    full_name: `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.value,
    first_name: e.first_name,
    title: e.position,
    email: e.value,
    email_verified: e.verification?.status === "valid" || e.confidence >= 90,
    email_source: "hunter",
    email_confidence: e.confidence ?? 60,
    linkedin_url: e.linkedin,
  })).filter((c: Contact) => c.email);
}

async function pdlPeople(company: string, domain: string | null): Promise<Contact[]> {
  if (!PDL_API_KEY) throw new Error("PDL_API_KEY missing");
  const params: any = { size: 5, dataset: "all" };
  const q: any = { bool: { must: [
    { term: { "job_company_name": company.toLowerCase() } },
  ]}};
  if (domain) q.bool.must.push({ term: { "job_company_website": domain } });
  const r = await fetch("https://api.peopledatalabs.com/v5/person/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": PDL_API_KEY },
    body: JSON.stringify({ ...params, query: q }),
  });
  if (!r.ok) throw new Error(`pdl ${r.status}`);
  const j = await r.json();
  const people = j?.data || [];
  return people.map((p: any) => ({
    full_name: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
    first_name: p.first_name,
    title: p.job_title,
    email: p.work_email || p.recommended_personal_email,
    email_verified: !!p.work_email,
    email_source: "pdl",
    email_confidence: p.work_email ? 80 : (p.recommended_personal_email ? 50 : 0),
    linkedin_url: p.linkedin_url,
  })).filter((c: Contact) => c.full_name && c.email);
}

async function patternVerify(company: string, domain: string | null): Promise<Contact[]> {
  if (!domain) throw new Error("no domain");
  // Generate a pattern guess from a generic title — the rank engine will down-score it
  const guesses = [`info@${domain}`, `purchasing@${domain}`, `sales@${domain}`];
  const out: Contact[] = [];
  for (const g of guesses) {
    let verified = false;
    let confidence = 35;
    if (HUNTER_API_KEY) {
      try {
        const u = new URL("https://api.hunter.io/v2/email-verifier");
        u.searchParams.set("email", g);
        u.searchParams.set("api_key", HUNTER_API_KEY);
        const r = await fetch(u.toString());
        if (r.ok) {
          const j = await r.json();
          if (j?.data?.status === "valid") { verified = true; confidence = 80; }
          else if (j?.data?.status === "accept_all") { confidence = 55; }
          else if (j?.data?.status === "invalid") { continue; }
        }
      } catch { /* skip — keep guess */ }
    }
    out.push({
      full_name: `${company} — ${g.split("@")[0]}`,
      title: g.split("@")[0],
      email: g,
      email_verified: verified,
      email_source: "pattern",
      email_confidence: confidence,
    });
  }
  return out;
}

async function siteScrape(company: string, website: string | null): Promise<Contact[]> {
  if (!website) throw new Error("no website");
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");
  // Try /contact, /team, /about
  const urls = [website, `${website.replace(/\/$/, "")}/contact`, `${website.replace(/\/$/, "")}/team`, `${website.replace(/\/$/, "")}/about`];
  let scraped = "";
  for (const url of urls) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const md = j?.markdown || j?.data?.markdown || "";
      if (md) { scraped += `\n\n=== ${url} ===\n${md.slice(0, 4000)}`; }
      if (scraped.length > 6000) break;
    } catch { /* try next */ }
  }
  if (!scraped) return [];
  // Regex sweep for emails first
  const emailMatches = Array.from(new Set(scraped.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi) || []))
    .filter((e) => !/(?:noreply|no-reply|webmaster|wordpress|example)@/i.test(e));
  const out: Contact[] = [];
  for (const e of emailMatches.slice(0, 3)) {
    out.push({
      full_name: `${company} — ${e.split("@")[0]}`,
      title: "site contact",
      email: e.toLowerCase(),
      email_verified: false,
      email_source: "site_scrape",
      email_confidence: 55,
    });
  }
  // AI extraction for richer name+title pairs (best effort)
  if (LOVABLE_API_KEY && scraped.length > 200) {
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: `Extract decision-makers from this scraped website content. Return JSON: { "people": [{"name":"","title":"","email":""}] }. Only include real people (first + last name), prefer titles like Owner, President, GM, Branch Manager, Purchasing, Buyer. Skip generic info@ entries.\n\nCONTENT:\n${scraped.slice(0, 6000)}`,
          }],
          response_format: { type: "json_object" },
        }),
      });
      if (aiRes.ok) {
        const j = await aiRes.json();
        const parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}");
        const people = parsed?.people || [];
        for (const p of people.slice(0, 3)) {
          if (!p?.name || !p.name.includes(" ")) continue;
          out.push({
            full_name: p.name,
            first_name: p.name.split(" ")[0],
            title: p.title || undefined,
            email: p.email?.toLowerCase() || undefined,
            email_verified: false,
            email_source: "site_scrape",
            email_confidence: p.email ? 60 : 30,
            seniority: tellSeniority(p.title),
          });
        }
      }
    } catch { /* AI optional */ }
  }
  return out;
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
