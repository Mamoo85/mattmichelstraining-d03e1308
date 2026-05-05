// lead-enrichment-extras.ts — 20 cold-email lead enrichment sources.
// Goes beyond email finding: returns decision-maker names, titles, tech stack,
// company size, industry, and buying signals to improve cold-email targeting.
// All sources use existing confirmed API keys or no key at all.
// Call runLeadEnrichmentWaterfall() to try all sources and merge results.

import { apolloPeopleSearch, apolloOrganizationEnrich } from "./apollo.ts";
import { hunterFindEmail } from "./hunter.ts";
import { firecrawlScrape } from "./firecrawl.ts";

const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const enc = (s: string) => encodeURIComponent(s);

async function safeText(url: string, init?: RequestInit, timeoutMs = 7000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.text();
  } catch { return null; }
}

async function safeJson(url: string, init?: RequestInit, timeoutMs = 7000): Promise<unknown> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
function pickEmail(text: string): string | null {
  return (text.match(EMAIL_RE) || []).find(
    (e) => !/\.(png|jpg|svg|css|js)$/i.test(e) && e.length < 80 &&
      !["noreply@","no-reply@","postmaster@"].some((p) => e.toLowerCase().startsWith(p)),
  ) || null;
}

export interface LeadEnrichment {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company_size?: string;
  industry?: string;
  tech_stack?: string[];
  funding_stage?: string;
  review_owner_name?: string;
  social_handles?: Record<string, string>;
  buying_signals?: string[];
  source: string;
  confidence: number;
}

// 1. Apollo people search — decision-maker name/title/email at domain
export async function enrichWithApolloPeople(
  domain: string,
): Promise<LeadEnrichment | null> {
  try {
    const result = await apolloPeopleSearch({
      organization_domains: [domain],
      person_titles: ["owner", "president", "gm", "general manager", "founder", "ceo", "director", "principal", "vp", "vice president"],
      page: 1,
      per_page: 5,
    });
    if (!result?.ok || !result.data) return null;
    const people = (result.data as { people?: Array<{
      first_name?: string; last_name?: string; title?: string;
      email?: string; linkedin_url?: string;
    }> })?.people || [];
    const p = people[0];
    if (!p) return null;
    return {
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      email: p.email,
      linkedin_url: p.linkedin_url,
      source: "apollo_people",
      confidence: p.email ? 85 : 60,
    };
  } catch { return null; }
}

// 2. Hunter domain search — all emails, return highest-confidence decision maker
export async function enrichWithHunterDomain(
  domain: string,
): Promise<LeadEnrichment | null> {
  try {
    const contact = await hunterFindEmail(domain);
    if (!contact?.email) return null;
    return {
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.position,
      email: contact.email,
      phone: contact.phone_number,
      linkedin_url: contact.linkedin,
      source: "hunter_domain",
      confidence: Math.min(contact.confidence, 95),
    };
  } catch { return null; }
}

// 3. Firecrawl /team page extraction — names, titles, emails
export async function enrichWithFirecrawlTeam(
  domain: string,
): Promise<LeadEnrichment | null> {
  for (const path of ["/team", "/about", "/staff", "/about-us", "/our-team"]) {
    try {
      const r = await firecrawlScrape(`https://${domain}${path}`, { onlyMainContent: true });
      if (!r?.markdown) continue;
      const email = pickEmail(r.markdown);
      // Extract name from markdown — look for "Owner" or "Founder" near a name
      const nameMatch = r.markdown.match(/(?:Owner|Founder|President|CEO|GM|Director)\W+([A-Z][a-z]+ [A-Z][a-z]+)/);
      const nameParts = nameMatch?.[1]?.split(" ");
      if (email || nameParts) {
        return {
          first_name: nameParts?.[0],
          last_name: nameParts?.[1],
          email: email || undefined,
          source: "firecrawl_team",
          confidence: email ? 70 : 50,
        };
      }
    } catch { /* try next */ }
  }
  return null;
}

// 4. LinkedIn company page — employee count + industry (public HTML, no auth)
export async function enrichWithLinkedInCompany(
  businessName: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(`https://www.linkedin.com/company/${enc(slug)}/about/`);
  if (!t) return null;
  const sizeMatch = t.match(/Company size[^<]*<[^>]+>([^<]+employees[^<]*)</i);
  const industryMatch = t.match(/Industry[^<]*<[^>]+>([^<]+)</i);
  if (!sizeMatch && !industryMatch) return null;
  return {
    company_size: sizeMatch?.[1]?.trim(),
    industry: industryMatch?.[1]?.trim(),
    source: "linkedin_company",
    confidence: 60,
  };
}

// 5. Crunchbase public org page — founder names, funding stage
export async function enrichWithCrunchbase(
  businessName: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(`https://www.crunchbase.com/organization/${enc(slug)}`);
  if (!t) return null;
  const fundingMatch = t.match(/"funding_stage":"([^"]+)"/i);
  const founderMatch = t.match(/"full_name":"([^"]+)","primary_role":"founder/i);
  const employeeMatch = t.match(/"employee_count":"([^"]+)"/i);
  if (!fundingMatch && !founderMatch) return null;
  const founderParts = founderMatch?.[1]?.split(" ");
  return {
    first_name: founderParts?.[0],
    last_name: founderParts?.slice(1).join(" "),
    funding_stage: fundingMatch?.[1],
    company_size: employeeMatch?.[1],
    source: "crunchbase",
    confidence: 55,
  };
}

// 6. Google Maps reviews — extract owner name from review reply signatures
export async function enrichWithGoogleReviewOwnerName(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const query = city ? `${businessName} ${city}` : businessName;
    const searchRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${enc(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_KEY}`,
    ) as { candidates?: Array<{ place_id: string }> } | null;
    const placeId = searchRes?.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const detailRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${GOOGLE_KEY}`,
    ) as { result?: { reviews?: Array<{ author_url?: string; text?: string; author_name?: string }> } } | null;
    const reviews = detailRes?.result?.reviews || [];
    // Owner replies appear as reviews with author = business owner
    const ownerReply = reviews.find((r) =>
      r.text && (r.author_url?.includes("owner") || r.author_name?.match(/owner|manager|staff/i))
    );
    if (!ownerReply?.author_name) return null;
    const parts = ownerReply.author_name.trim().split(" ");
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(" "),
      review_owner_name: ownerReply.author_name,
      source: "google_reviews_owner",
      confidence: 55,
    };
  } catch { return null; }
}

// 7. BuiltWith free tech stack — CRM, CMS, analytics to score ICP fit
export async function enrichWithBuiltWith(
  domain: string,
): Promise<LeadEnrichment | null> {
  try {
    const j = await safeJson(
      `https://api.builtwith.com/free1/api.json?KEY=free&LOOKUP=${enc(domain)}`,
    ) as { Results?: Array<{ Result?: { Paths?: Array<{ Technologies?: Array<{ Name: string }> }> } }> } | null;
    const techs = j?.Results?.[0]?.Result?.Paths?.flatMap(
      (p) => p.Technologies?.map((t) => t.Name) || [],
    ).filter(Boolean) as string[] || [];
    if (!techs.length) return null;
    return {
      tech_stack: techs,
      source: "builtwith",
      confidence: 70,
      buying_signals: [
        techs.some((t) => /wix|squarespace|weebly|godaddy/i.test(t)) ? "DIY_website_upgrade_candidate" : "",
        techs.some((t) => /hubspot|salesforce|pipedrive/i.test(t)) ? "" : "no_crm_detected",
        techs.some((t) => /shopify|woocommerce|bigcommerce/i.test(t)) ? "ecommerce_merchant" : "",
      ].filter(Boolean),
    };
  } catch { return null; }
}

// 8. Clearbit company enrichment (public rate-limited endpoint)
export async function enrichWithClearbit(
  domain: string,
): Promise<LeadEnrichment | null> {
  try {
    const j = await safeJson(
      `https://company.clearbit.com/v1/companies/find?domain=${enc(domain)}`,
    ) as {
      name?: string; industry?: string; metrics?: { employees?: number };
      twitter?: { handle?: string }; linkedin?: { handle?: string };
      category?: { industry?: string; sector?: string };
    } | null;
    if (!j?.name) return null;
    return {
      company_size: j.metrics?.employees ? `${j.metrics.employees}` : undefined,
      industry: j.category?.industry || j.industry,
      social_handles: {
        ...(j.twitter?.handle ? { twitter: j.twitter.handle } : {}),
        ...(j.linkedin?.handle ? { linkedin: j.linkedin.handle } : {}),
      },
      source: "clearbit_free",
      confidence: 65,
    };
  } catch { return null; }
}

// 9. Reddit self-promotion posts — find contractor posts with contact info
export async function enrichWithReddit(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  try {
    const q = city ? `${businessName} ${city}` : businessName;
    const j = await safeJson(
      `https://www.reddit.com/search.json?q=${enc(q)}&type=link&sort=relevance&limit=5`,
    ) as { data?: { children?: Array<{ data?: { selftext?: string; author?: string } }> } } | null;
    const posts = j?.data?.children || [];
    for (const post of posts) {
      const text = post.data?.selftext || "";
      const email = pickEmail(text);
      if (email) {
        return { email, source: "reddit", confidence: 50 };
      }
    }
    return null;
  } catch { return null; }
}

// 10. Google My Business category + phone — score ICP fit
export async function enrichWithGoogleMyBusiness(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const query = city ? `${businessName} ${city}` : businessName;
    const searchRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${enc(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_KEY}`,
    ) as { candidates?: Array<{ place_id: string }> } | null;
    const placeId = searchRes?.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const detailRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,types,formatted_phone_number,website,rating,user_ratings_total&key=${GOOGLE_KEY}`,
    ) as { result?: {
      types?: string[]; formatted_phone_number?: string; website?: string;
      rating?: number; user_ratings_total?: number;
    } } | null;
    const r = detailRes?.result;
    if (!r) return null;
    const signals: string[] = [];
    if (r.rating && r.rating >= 4.0 && (r.user_ratings_total || 0) >= 10) {
      signals.push("established_reviews");
    }
    if (!r.website) signals.push("no_website_detected");
    return {
      phone: r.formatted_phone_number,
      industry: r.types?.[0]?.replace(/_/g, " "),
      buying_signals: signals,
      source: "google_my_business",
      confidence: 70,
    };
  } catch { return null; }
}

// 11. Instagram business bio — email in bio or linktree link
export async function enrichWithInstagram(
  businessName: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "").slice(0, 24);
  const t = await safeText(`https://www.instagram.com/${enc(slug)}/`);
  if (!t) return null;
  const email = pickEmail(t);
  if (email) return { email, source: "instagram_bio", confidence: 55 };
  // Check for linktree
  const ltMatch = t.match(/linktr\.ee\/([a-zA-Z0-9_]+)/);
  if (ltMatch) {
    const ltPage = await safeText(`https://linktr.ee/${ltMatch[1]}`);
    const ltEmail = ltPage ? pickEmail(ltPage) : null;
    if (ltEmail) return { email: ltEmail, source: "instagram_linktree", confidence: 50 };
  }
  return null;
}

// 12. Facebook business page about section email
export async function enrichWithFacebook(
  businessName: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]+/g, "");
  const t = await safeText(`https://www.facebook.com/${enc(slug)}/about`);
  if (!t) return null;
  const email = pickEmail(t);
  if (email) return { email, source: "facebook_about", confidence: 55 };
  return null;
}

// 13. Nextdoor neighborhood recommendations — local contractor contact info
export async function enrichWithNextdoor(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  const q = city ? `${businessName} ${city}` : businessName;
  const t = await safeText(
    `https://nextdoor.com/pages/search/?query=${enc(q)}`,
  );
  if (!t) return null;
  const email = pickEmail(t);
  if (email) return { email, source: "nextdoor", confidence: 55 };
  return null;
}

// 14. Houzz contractor profile — email, phone, specialties
export async function enrichWithHouzz(
  businessName: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(`https://www.houzz.com/professionals/${enc(slug)}/p/${enc(slug)}`);
  if (!t) return null;
  const email = pickEmail(t);
  const phoneMatch = t.match(/tel:([+\d\-().]+)/);
  if (!email && !phoneMatch) return null;
  return {
    email: email || undefined,
    phone: phoneMatch?.[1],
    source: "houzz",
    confidence: 60,
  };
}

// 15. HomeAdvisor pro listing — contact URL + email
export async function enrichWithHomeAdvisor(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(
    `https://www.homeadvisor.com/c.${enc(slug)}.${enc(city || "")}.html`,
  );
  if (!t) return null;
  const email = pickEmail(t);
  if (email) return { email, source: "homeadvisor", confidence: 55 };
  return null;
}

// 16. OSHA inspection data — company name, address, violation type (growth signal)
export async function enrichWithOsha(
  businessName: string,
  state?: string,
): Promise<LeadEnrichment | null> {
  try {
    const q: Record<string, string | number> = {
      establishment_name: businessName,
      per_page: 5,
    };
    if (state) q.state_plan_code = state;
    const params = Object.entries(q).map(([k, v]) => `${k}=${enc(String(v))}`).join("&");
    const j = await safeJson(
      `https://data.dol.gov/api/v1/compliance/osha/inspections?${params}`,
    ) as { data?: Array<{ establishment_name?: string; site_address?: string; open_date?: string }> } | null;
    const records = j?.data || [];
    if (!records.length) return null;
    return {
      buying_signals: ["osha_inspected", `violations_${records.length}`],
      source: "osha_inspection",
      confidence: 60,
    };
  } catch { return null; }
}

// 17. SBA loan recipients — PPP/EIDL by name (credit-verified, growth signal)
export async function enrichWithSba(
  businessName: string,
  zipCode?: string,
): Promise<LeadEnrichment | null> {
  try {
    const filters: Record<string, unknown> = {
      q: businessName,
      limit: 5,
    };
    if (zipCode) filters.filters = { zip: zipCode };
    const j = await safeJson(
      `https://data.sba.gov/api/3/action/datastore_search?resource_id=aab2e42a-d2a6-4fc5-b2d6-c2d3f9f0c46e&q=${enc(businessName)}&limit=5`,
    ) as { result?: { records?: Array<{ BorrowerName?: string; LoanAmount?: string; ApprovalDate?: string }> } } | null;
    const records = j?.result?.records || [];
    if (!records.length) return null;
    const r = records[0];
    return {
      buying_signals: [
        "sba_loan_recipient",
        r.LoanAmount ? `sba_loan_${Math.round(Number(r.LoanAmount.replace(/[^0-9]/g, "")) / 1000)}k` : "",
      ].filter(Boolean),
      source: "sba_loans",
      confidence: 55,
    };
  } catch { return null; }
}

// 18. Michigan UIA employer records — active employer status
export async function enrichWithMichiganUia(
  businessName: string,
): Promise<LeadEnrichment | null> {
  try {
    const t = await safeText(
      `https://uia.michigan.gov/uia/EmployerLookup?action=search&ein=&name=${enc(businessName)}`,
    );
    if (!t) return null;
    const email = pickEmail(t);
    const hasRecord = t.includes("Employer Name") || t.includes("Active");
    if (!hasRecord) return null;
    return {
      email: email || undefined,
      buying_signals: ["michigan_uia_active_employer"],
      source: "michigan_uia",
      confidence: 60,
    };
  } catch { return null; }
}

// 19. Yelp category search — paginated results for trade verticals (no key)
export async function enrichWithYelpCategory(
  category: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  try {
    const t = await safeText(
      `https://www.yelp.com/search?find_desc=${enc(category)}&find_loc=${enc(city || "Detroit, MI")}`,
    );
    if (!t) return null;
    // Extract phone numbers as enrichment signal (available in Yelp HTML)
    const phoneMatch = t.match(/tel:([+\d\-().]+)/);
    const email = pickEmail(t);
    if (!email && !phoneMatch) return null;
    return {
      email: email || undefined,
      phone: phoneMatch?.[1],
      source: "yelp_category",
      confidence: 50,
    };
  } catch { return null; }
}

// 20. DuckDuckGo Instant Answer — structured business summary, website, phone
export async function enrichWithDuckDuckGo(
  businessName: string,
  city?: string,
): Promise<LeadEnrichment | null> {
  try {
    const q = city ? `${businessName} ${city}` : businessName;
    const j = await safeJson(
      `https://api.duckduckgo.com/?q=${enc(q)}&format=json&no_html=1&skip_disambig=1`,
    ) as {
      Answer?: string; AbstractText?: string; AbstractURL?: string;
      Infobox?: { content?: Array<{ label: string; value: string }> };
    } | null;
    if (!j) return null;
    const infobox = j.Infobox?.content || [];
    const phoneEntry = infobox.find((e) => /phone|telephone/i.test(e.label));
    const emailEntry = infobox.find((e) => /email/i.test(e.label));
    const websiteEntry = infobox.find((e) => /website|web/i.test(e.label));
    if (!phoneEntry && !emailEntry && !websiteEntry) return null;
    return {
      email: emailEntry?.value,
      phone: phoneEntry?.value,
      social_handles: websiteEntry ? { website: websiteEntry.value } : {},
      source: "duckduckgo_instant",
      confidence: 55,
    };
  } catch { return null; }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export type LeadEnrichmentInput = {
  domain?: string | null;
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  trade_category?: string | null;
};

export type LeadEnrichmentOutput = {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company_size?: string;
  industry?: string;
  tech_stack?: string[];
  funding_stage?: string;
  review_owner_name?: string;
  social_handles?: Record<string, string>;
  buying_signals?: string[];
  sources_tried: string[];
  sources_hit: string[];
  confidence: number;
};

/**
 * Run all 20 enrichment sources in priority order. Stop at first email hit;
 * continue accumulating non-email fields (buying signals, tech stack) from
 * remaining sources until a configurable enrichment depth is reached.
 */
export async function runLeadEnrichmentWaterfall(
  input: LeadEnrichmentInput,
  opts?: { stopOnEmail?: boolean; maxSources?: number },
): Promise<LeadEnrichmentOutput> {
  const stopOnEmail = opts?.stopOnEmail ?? false;
  const maxSources = opts?.maxSources ?? 20;
  const domain = input.domain?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  const name = input.business_name || null;
  const city = input.city || null;
  const state = input.state || null;
  const zip = input.zip_code || null;
  const category = input.trade_category || null;

  const output: LeadEnrichmentOutput = {
    sources_tried: [],
    sources_hit: [],
    buying_signals: [],
    confidence: 0,
  };

  function merge(r: LeadEnrichment | null) {
    if (!r) return;
    output.sources_hit.push(r.source);
    if (!output.first_name && r.first_name) output.first_name = r.first_name;
    if (!output.last_name && r.last_name) output.last_name = r.last_name;
    if (!output.title && r.title) output.title = r.title;
    if (!output.email && r.email) output.email = r.email;
    if (!output.phone && r.phone) output.phone = r.phone;
    if (!output.linkedin_url && r.linkedin_url) output.linkedin_url = r.linkedin_url;
    if (!output.company_size && r.company_size) output.company_size = r.company_size;
    if (!output.industry && r.industry) output.industry = r.industry;
    if (!output.tech_stack && r.tech_stack) output.tech_stack = r.tech_stack;
    if (!output.funding_stage && r.funding_stage) output.funding_stage = r.funding_stage;
    if (!output.review_owner_name && r.review_owner_name) output.review_owner_name = r.review_owner_name;
    if (r.social_handles) output.social_handles = { ...output.social_handles, ...r.social_handles };
    if (r.buying_signals) output.buying_signals = [...(output.buying_signals || []), ...r.buying_signals];
    output.confidence = Math.max(output.confidence, r.confidence);
  }

  const sources: Array<{ name: string; fn: () => Promise<LeadEnrichment | null> }> = [
    { name: "apollo_people",          fn: () => domain ? enrichWithApolloPeople(domain) : Promise.resolve(null) },
    { name: "hunter_domain",          fn: () => domain ? enrichWithHunterDomain(domain) : Promise.resolve(null) },
    { name: "firecrawl_team",         fn: () => domain ? enrichWithFirecrawlTeam(domain) : Promise.resolve(null) },
    { name: "google_my_business",     fn: () => name ? enrichWithGoogleMyBusiness(name, city ?? undefined) : Promise.resolve(null) },
    { name: "google_reviews_owner",   fn: () => name ? enrichWithGoogleReviewOwnerName(name, city ?? undefined) : Promise.resolve(null) },
    { name: "builtwith",              fn: () => domain ? enrichWithBuiltWith(domain) : Promise.resolve(null) },
    { name: "clearbit_free",          fn: () => domain ? enrichWithClearbit(domain) : Promise.resolve(null) },
    { name: "linkedin_company",       fn: () => name ? enrichWithLinkedInCompany(name) : Promise.resolve(null) },
    { name: "crunchbase",             fn: () => name ? enrichWithCrunchbase(name) : Promise.resolve(null) },
    { name: "instagram_bio",          fn: () => name ? enrichWithInstagram(name) : Promise.resolve(null) },
    { name: "facebook_about",         fn: () => name ? enrichWithFacebook(name) : Promise.resolve(null) },
    { name: "houzz",                  fn: () => name ? enrichWithHouzz(name) : Promise.resolve(null) },
    { name: "homeadvisor",            fn: () => name ? enrichWithHomeAdvisor(name, city ?? undefined) : Promise.resolve(null) },
    { name: "nextdoor",               fn: () => name ? enrichWithNextdoor(name, city ?? undefined) : Promise.resolve(null) },
    { name: "yelp_category",          fn: () => (category || name) ? enrichWithYelpCategory(category || name!, city ?? undefined) : Promise.resolve(null) },
    { name: "reddit",                 fn: () => name ? enrichWithReddit(name, city ?? undefined) : Promise.resolve(null) },
    { name: "osha_inspection",        fn: () => name ? enrichWithOsha(name, state ?? undefined) : Promise.resolve(null) },
    { name: "sba_loans",              fn: () => name ? enrichWithSba(name, zip ?? undefined) : Promise.resolve(null) },
    { name: "michigan_uia",           fn: () => name && (state === "MI" || !state) ? enrichWithMichiganUia(name) : Promise.resolve(null) },
    { name: "duckduckgo_instant",     fn: () => name ? enrichWithDuckDuckGo(name, city ?? undefined) : Promise.resolve(null) },
  ];

  let tried = 0;
  for (const s of sources) {
    if (tried >= maxSources) break;
    output.sources_tried.push(s.name);
    tried++;
    try {
      const r = await s.fn();
      merge(r);
      if (stopOnEmail && output.email) break;
    } catch { /* fail-open */ }
  }

  return output;
}
