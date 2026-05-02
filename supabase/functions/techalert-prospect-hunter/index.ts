// techalert-prospect-hunter — daily 6am ET cron
// Finds HVAC/boiler/plumbing/electrical shops in Metro Detroit actively
// hiring techs on job boards. These are perfect TechAlert prospects.
//
// CRITICAL: Outputs (cold emails, postcards, Matt-facing copy) MUST NEVER
// reveal that we monitor licensing databases, scrape job boards, or use
// any third-party intelligence vendor. We are "a Detroit-area hiring
// monitoring service." Period.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const EVENTBRITE_API_KEY = Deno.env.get("EVENTBRITE_API_KEY") || "";
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";
const NOAA_API_KEY = Deno.env.get("NOAA_API_KEY") || "";
// BLS, USASpending.gov, SEC EDGAR, USPTO PatentsView are fully open — no key required.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = [
  { key: "hvac_tech", q: "HVAC technician", boiler: false },
  { key: "boiler_operator", q: "boiler operator OR stationary engineer", boiler: true },
  { key: "plumber", q: "plumber OR pipefitter", boiler: false },
  { key: "electrician", q: "electrician OR industrial electrician", boiler: false },
];

const METRO_QUERY = "Metro Detroit OR Detroit OR Warren OR Sterling Heights OR Livonia OR Dearborn OR Troy OR Southfield Michigan";

interface Posting {
  company_name: string;
  city?: string;
  role: string;
  days_posted?: number;
  source_url?: string;
  source_label?: string;
  is_boiler: boolean;
}

async function sonarSearch(role: typeof ROLES[number]): Promise<Posting[]> {
  if (!OPENROUTER_API_KEY) return [];
  const prompt = `Find ACTIVE job postings on Indeed, ZipRecruiter, SimplyHired, and LinkedIn Jobs for "${role.q}" in ${METRO_QUERY}. Return ONLY a JSON array, no prose. Each item: {"company_name": "string", "city": "string", "days_posted": number_estimate_or_null, "source_url": "url", "source_label": "Indeed|ZipRecruiter|SimplyHired|LinkedIn"}. Find at least 12 distinct companies. Skip staffing agencies, temp agencies, recruiters. Only direct employers (HVAC contractors, plumbing companies, electrical contractors, mechanical contractors, manufacturers).`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error(`[hunter] sonar ${role.key} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return (Array.isArray(arr) ? arr : [])
      .filter((x: any) => x?.company_name)
      .map((x: any) => ({
        company_name: String(x.company_name).trim(),
        city: x.city ? String(x.city).trim() : undefined,
        role: role.key,
        days_posted: typeof x.days_posted === "number" ? x.days_posted : null,
        source_url: x.source_url || undefined,
        source_label: x.source_label || undefined,
        is_boiler: role.boiler,
      } as Posting));
  } catch (e) {
    console.error(`[hunter] sonar ${role.key} error:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// GitHub: companies with recent repo activity spikes signal tech team expansion / hiring burst
async function scanGitHubSignals(): Promise<Posting[]> {
  if (!GITHUB_TOKEN) return [];
  const results: Posting[] = [];

  // Search for HVAC/mechanical/building-automation companies on GitHub with recent pushes
  const queries = [
    "hvac automation michigan",
    "building automation detroit",
    "mechanical contractor software",
    "plumbing contractor management",
  ];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "TechAlert-ProspectHunter/1.0",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const repo of (data.items || [])) {
        const orgName: string = repo.owner?.login || "";
        const pushed = repo.pushed_at ? new Date(repo.pushed_at) : null;
        if (!orgName || !pushed) continue;
        const daysSincePush = (Date.now() - pushed.getTime()) / 86400000;
        if (daysSincePush > 30) continue; // only fresh activity
        results.push({
          company_name: orgName.replace(/-/g, " ").replace(/_/g, " "),
          city: "Metro Detroit", // GitHub doesn't give precise city; enrichment fills this later
          role: "hvac_tech",
          days_posted: null,
          source_url: repo.html_url,
          source_label: "GitHub",
          is_boiler: false,
        });
      }
    } catch (e) {
      console.error("[hunter] github scan error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// SEC EDGAR: Form D filings = funding rounds = company scaling = hiring burst
async function scanEDGARFundings(): Promise<Posting[]> {
  const results: Posting[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const industryTerms = ["HVAC", "plumbing", "mechanical contractor", "boiler", "electrical contractor"];

  for (const term of industryTerms) {
    try {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${term}"`)}&dateRange=custom&startdt=${thirtyDaysAgo}&forms=D&hits.hits._source=entity_name,period_of_report,items,file_date`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const hit of (data?.hits?.hits || [])) {
        const src = hit._source || {};
        const entityName: string = src.entity_name || "";
        if (!entityName) continue;
        results.push({
          company_name: entityName,
          city: undefined,
          role: "hvac_tech",
          days_posted: null,
          source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(entityName)}&type=D&dateb=&owner=include&count=10`,
          source_label: "SEC EDGAR",
          is_boiler: term === "boiler",
        });
      }
    } catch (e) {
      console.error("[hunter] edgar scan error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// USPTO PatentsView: recent patent filings = R&D expansion = 60-90 day hiring signal
async function scanUSPTOPatents(): Promise<Posting[]> {
  const results: Posting[] = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  // CPC subclasses relevant to HVAC/boiler/plumbing/electrical
  const cpcSubclasses = ["F24F", "F22B", "E03C", "H02B"]; // HVAC, boilers, plumbing, electrical panels

  for (const cpc of cpcSubclasses) {
    try {
      const body = {
        q: { _and: [{ _gte: { patent_date: ninetyDaysAgo } }, { _text_any: { cpc_subgroup_id: cpc } }] },
        f: ["assignee_organization", "patent_date", "patent_title", "patent_id"],
        o: { per_page: 15 },
      };
      const res = await fetch("https://search.patentsview.org/api/v1/patent/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "TechAlert matt@detroitwebagent.com" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const patent of (data?.patents || [])) {
        const assignee: string = patent.assignee_organization || "";
        if (!assignee) continue;
        results.push({
          company_name: assignee,
          city: undefined,
          role: cpc === "F22B" ? "boiler_operator" : "hvac_tech",
          days_posted: null,
          source_url: `https://search.patentsview.org/api/v1/patent/${patent.patent_id}`,
          source_label: "USPTO",
          is_boiler: cpc === "F22B",
        });
      }
    } catch (e) {
      console.error("[hunter] uspto scan error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// NOAA: extreme weather in Metro Detroit = HVAC hiring demand spike.
// Returns a bonus score (0-3) applied to HVAC/boiler prospects found today.
// 0 = normal weather, 1 = moderate extreme, 2 = significant, 3 = emergency-level.
// Uses the NWS gridpoint API — free, no key required beyond User-Agent.
async function getWeatherHiringBonus(): Promise<number> {
  try {
    // Detroit NWS grid: DTX/65,33 — validated stable gridpoint
    const forecastRes = await fetch(
      "https://api.weather.gov/gridpoints/DTX/65,33/forecast/hourly",
      {
        headers: {
          "User-Agent": "TechAlert-ProspectHunter/1.0 (matt@detroitwebagent.com)",
          Accept: "application/geo+json",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!forecastRes.ok) return 0;
    const data = await forecastRes.json();
    const periods: any[] = data?.properties?.periods || [];

    // Look at next 24 hours
    const next24 = periods.slice(0, 24);
    const temps = next24.map((p: any) => p.temperature as number).filter(Boolean);
    if (!temps.length) return 0;

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);

    // Cold emergencies (heating/boiler demand)
    if (minTemp <= 5) return 3;   // extreme cold — boiler/furnace emergencies surge
    if (minTemp <= 15) return 2;  // severe cold
    if (minTemp <= 25) return 1;  // notable cold

    // Heat emergencies (AC/cooling demand)
    if (maxTemp >= 100) return 3; // extreme heat
    if (maxTemp >= 95) return 2;  // severe heat
    if (maxTemp >= 90) return 1;  // notable heat

    return 0;
  } catch (e) {
    console.error("[hunter] noaa error:", e instanceof Error ? e.message : e);
    return 0;
  }
}

// SAM.gov: awarded federal contracts to trades/HVAC firms = scaling signal
async function scanSAMGovContracts(): Promise<Posting[]> {
  if (!SAM_GOV_API_KEY) return [];
  const results: Posting[] = [];
  const naicsCodes = ["238220", "238210", "238290", "221330"]; // HVAC, electrical, other mechanical, steam/AC
  for (const naics of naicsCodes) {
    try {
      const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&naicsCode=${naics}&postedFrom=${new Date(Date.now()-30*86400000).toISOString().slice(0,10)}&limit=10&index=opp`;
      const res = await fetch(url, { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const opp of (data?.opportunitiesData || [])) {
        const awardee: string = opp?.award?.awardee?.name || opp?.awardee?.name || "";
        if (!awardee) continue;
        results.push({
          company_name: awardee,
          city: opp?.award?.awardee?.location?.city?.name || undefined,
          role: naics === "238210" ? "electrician" : "hvac_tech",
          days_posted: null,
          source_url: `https://sam.gov/opp/${opp.noticeId}/view`,
          source_label: "SAM.gov",
          is_boiler: naics === "221330",
        });
      }
    } catch (e) {
      console.error("[hunter] sam.gov error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// BLS: metros with rising HVAC/electrical employment = expansion markets (free, no key)
async function scanBLSEmployment(): Promise<Posting[]> {
  // BLS series IDs: HVAC mechanics (SMU26197503472120001) Detroit-Warren-Dearborn
  // Returns employment level — used to score city demand, not individual companies
  // We return empty array since BLS gives metro-level data, not company names.
  // Instead, use the data to log signals to agent_heartbeats metadata for market intelligence.
  try {
    const series = ["SMU26197503472120001", "SMU26197503441100001"]; // Detroit HVAC + Electricians
    const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "TechAlert matt@detroitwebagent.com" },
      body: JSON.stringify({ seriesid: series, startyear: "2025", endyear: "2026" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = await res.json();
      const latest = data?.Results?.series?.[0]?.data?.[0];
      if (latest) console.log(`[hunter] BLS Detroit HVAC employment: ${latest.value} (${latest.year}-${latest.period})`);
    }
  } catch (_) {}
  return []; // BLS gives market intel only; company targets come from other sources
}

// Eventbrite: trade shows & HVAC/contractor conferences = expansion-minded companies
async function scanEventbriteSignals(): Promise<Posting[]> {
  if (!EVENTBRITE_API_KEY) return [];
  const results: Posting[] = [];
  const queries = ["HVAC trade show", "contractor expo michigan", "plumbing electrical conference detroit"];
  for (const q of queries) {
    try {
      const url = `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(q)}&location.address=Michigan&expand=organizer&token=${EVENTBRITE_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const ev of (data?.events || []).slice(0, 5)) {
        const orgName: string = ev?.organizer?.name || "";
        if (!orgName || orgName.toLowerCase().includes("eventbrite")) continue;
        results.push({
          company_name: orgName,
          city: ev?.venue?.city || undefined,
          role: "hvac_tech",
          days_posted: null,
          source_url: ev?.url || undefined,
          source_label: "Eventbrite",
          is_boiler: false,
        });
      }
    } catch (e) {
      console.error("[hunter] eventbrite error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// USASpending.gov: federal contract awards to trades companies (free, no key)
async function scanUSASpending(): Promise<Posting[]> {
  const results: Posting[] = [];
  const naicsCodes = ["238220", "238210", "238290"]; // HVAC, electrical, other mechanical
  for (const naics of naicsCodes) {
    try {
      const body = {
        filters: {
          naics_codes: [naics],
          time_period: [{ start_date: new Date(Date.now()-60*86400000).toISOString().slice(0,10), end_date: new Date().toISOString().slice(0,10) }],
          place_of_performance_locations: [{ country: "USA", state: "MI" }],
        },
        fields: ["recipient_name", "recipient_location", "award_amount", "naics_code"],
        limit: 10,
        sort: "award_amount",
        order: "desc",
      };
      const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "TechAlert matt@detroitwebagent.com" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const award of (data?.results || [])) {
        const name: string = award?.recipient_name || "";
        if (!name) continue;
        results.push({
          company_name: name,
          city: award?.recipient_location?.city_name || undefined,
          role: naics === "238210" ? "electrician" : "hvac_tech",
          days_posted: null,
          source_url: `https://www.usaspending.gov/search/?query=${encodeURIComponent(name)}`,
          source_label: "USASpending",
          is_boiler: false,
        });
      }
    } catch (e) {
      console.error("[hunter] usaspending error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// LinkedIn: job postings via People API search (uses existing LINKEDIN_ACCESS_TOKEN)
async function scanLinkedInJobs(): Promise<Posting[]> {
  if (!LINKEDIN_ACCESS_TOKEN) return [];
  const results: Posting[] = [];
  // LinkedIn Job Search API — searches public job postings
  const keywords = ["HVAC technician hiring Michigan", "boiler operator Detroit", "electrician jobs Michigan"];
  for (const kw of keywords) {
    try {
      const res = await fetch(
        `https://api.linkedin.com/v2/jobPostings?q=jobPostingsByKeywordsAndLocation&keywords=${encodeURIComponent(kw)}&locationId=us%3A0&count=10`,
        {
          headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`, "LinkedIn-Version": "202401" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of (data?.elements || [])) {
        const companyName: string = job?.companyDetails?.["com.linkedin.voyager.jobs.JobPostingCompany"]?.company?.name || "";
        if (!companyName) continue;
        results.push({
          company_name: companyName,
          city: job?.formattedLocation || undefined,
          role: kw.includes("boiler") ? "boiler_operator" : kw.includes("electrician") ? "electrician" : "hvac_tech",
          days_posted: null,
          source_url: job?.applyMethod?.["com.linkedin.voyager.jobs.OffsiteApply"]?.companyApplyUrl || undefined,
          source_label: "LinkedIn",
          is_boiler: kw.includes("boiler"),
        });
      }
    } catch (e) {
      console.error("[hunter] linkedin error:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// OSHA enforcement data — MI NAICS 23x (construction) violations = active company signal
async function scanOSHAViolations(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const url = `https://data.dol.gov/get/full_case/rows/0/offset/0?_where=site_state%3D%27MI%27%20AND%20primary_site_naics%20LIKE%20%2723%25%27%20AND%20open_date%20%3E%3D%20%27${since}%27&_sort=open_date%20DESC`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return results;
    const data = await res.json();
    for (const c of (data || []).slice(0, 15)) {
      const name: string = c?.establishment_name || "";
      if (!name) continue;
      results.push({
        company_name: name,
        city: c?.site_city || undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${c?.activity_nr || ""}`,
        source_label: "OSHA",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] OSHA:", e instanceof Error ? e.message : e); }
  return results;
}

// Michigan LARA — newly licensed contractors (fresh businesses = TechAlert sweet spot)
async function scanLARANewLicenses(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=ALL&searchType=DATE&dateSearchType=LICENSURE&dateFrom=${twoWeeksAgo}&licenseTypes=2601,2602,2604,2605,2606`; // HVAC/electrical/plumbing codes
    const res = await fetch(url, { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return results;
    const data = await res.json();
    for (const lic of (data?.items || data || []).slice(0, 20)) {
      const name: string = lic?.entityName || lic?.name || "";
      if (!name) continue;
      results.push({
        company_name: name,
        city: lic?.city || undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://cofs.lara.state.mi.us/CorpWeb/CorpSearch/CorpSummary.aspx?ID=${lic?.id || ""}`,
        source_label: "LARA New License",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] LARA new license:", e instanceof Error ? e.message : e); }
  return results;
}

// Michigan LARA — dissolved LLCs (employees now available; competitors hiring)
async function scanLARADissolved(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=ALL&searchType=DATE&dateSearchType=DISSOLUTION&dateFrom=${thirtyDaysAgo}`;
    const res = await fetch(url, { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return results;
    const data = await res.json();
    for (const ent of (data?.items || data || []).slice(0, 20)) {
      const name: string = ent?.entityName || ent?.name || "";
      if (!name) continue;
      // Only flag trade-adjacent company names
      if (!/(hvac|heat|cool|plumb|electric|mechanical|contractor|construction|services|repair)/i.test(name)) continue;
      results.push({
        company_name: name,
        city: ent?.city || undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://cofs.lara.state.mi.us/CorpWeb/CorpSearch/CorpSummary.aspx?ID=${ent?.id || ""}`,
        source_label: "LARA Dissolved LLC",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] LARA dissolved:", e instanceof Error ? e.message : e); }
  return results;
}

// NLRB union election petitions — construction industry organizing = active workforce, scaling company
async function scanNLRBPetitions(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.nlrb.gov/reports-research/api/cases?filed_from=${since}&industry_code=23`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const data = await res.json();
    for (const c of (data?.results || data?.cases || []).slice(0, 10)) {
      const name: string = c?.employer_name || c?.respondent || "";
      if (!name) continue;
      results.push({
        company_name: name,
        city: c?.city || undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://www.nlrb.gov/case/${c?.case_number || ""}`,
        source_label: "NLRB Petition",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] NLRB:", e instanceof Error ? e.message : e); }
  return results;
}

function scorePosting(p: Posting, openRolesCount: number, repostCount: number, weatherBonus = 0): number {
  let score = 0;
  if ((p.days_posted ?? 0) > 14) score += 3;
  if (repostCount > 0) score += 2;
  if (openRolesCount >= 2) score += 2;
  if (p.is_boiler) score += 1;
  // Apply weather bonus only to HVAC/boiler roles — extreme temps spike their hiring demand
  if (weatherBonus > 0 && (p.role === "hvac_tech" || p.role === "boiler_operator")) {
    score += weatherBonus;
  }
  return Math.max(1, score);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0, updated = 0, scanned = 0;

  try {
    const all: Posting[] = [];
    for (const role of ROLES) {
      const found = await sonarSearch(role);
      all.push(...found);
      scanned += found.length;
    }

    // Supplemental signals + NOAA weather bonus — all run in parallel
    // Includes the new signal-waterfall (DOL WARN, OSHA, FMCSA, DOT prequal, SAM expanded)
    const { fetchHireSignals } = await import("../_shared/signal-waterfall.ts");
    const [githubSignals, edgarSignals, usptoSignals, samSignals, blsSignals, eventbriteSignals, usaSpendingSignals, linkedinSignals, oshaSignals, laraNewSignals, laraDissolvedSignals, nlrbSignals, weatherBonus, hireWaterfallSignals] = await Promise.all([
      scanGitHubSignals(),
      scanEDGARFundings(),
      scanUSPTOPatents(),
      scanSAMGovContracts(),
      scanBLSEmployment(),
      scanEventbriteSignals(),
      scanUSASpending(),
      scanLinkedInJobs(),
      scanOSHAViolations(),
      scanLARANewLicenses(),
      scanLARADissolved(),
      scanNLRBPetitions(),
      getWeatherHiringBonus(),
      fetchHireSignals(sb, { state: "MI", naics: "238220" }).catch(() => []),
    ]);
    const supplemental = [...githubSignals, ...edgarSignals, ...usptoSignals, ...samSignals, ...blsSignals, ...eventbriteSignals, ...usaSpendingSignals, ...linkedinSignals, ...oshaSignals, ...laraNewSignals, ...laraDissolvedSignals, ...nlrbSignals];
    all.push(...supplemental);
    scanned += supplemental.length;
    // Log waterfall signal volume to heartbeat metadata (don't insert as job postings — different shape)
    const waterfallCount = (hireWaterfallSignals as any[]).length;

    // Group by company to compute open_roles_count
    const byCompany = new Map<string, Posting[]>();
    for (const p of all) {
      const key = p.company_name.toLowerCase().trim();
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(p);
    }

    for (const [_, postings] of byCompany) {
      const openRolesCount = new Set(postings.map((p) => p.role)).size;
      for (const p of postings) {
        // Check existing for repost detection
        const { data: existing } = await sb
          .from("techalert_prospect_targets")
          .select("id, repost_count, status")
          .ilike("company_name", p.company_name)
          .eq("role", p.role)
          .maybeSingle();

        const repostCount = existing ? (existing.repost_count ?? 0) + 1 : 0;
        const score = scorePosting(p, openRolesCount, repostCount, weatherBonus as number);

        if (existing) {
          await sb.from("techalert_prospect_targets").update({
            days_posted: p.days_posted,
            repost_count: repostCount,
            open_roles_count: openRolesCount,
            score,
            source_url: p.source_url,
            source_label: p.source_label,
            city: p.city,
            is_boiler: p.is_boiler,
          }).eq("id", existing.id);
          updated++;
        } else {
          const { error } = await sb.from("techalert_prospect_targets").insert({
            company_name: p.company_name,
            city: p.city,
            role: p.role,
            days_posted: p.days_posted,
            repost_count: 0,
            open_roles_count: openRolesCount,
            is_boiler: p.is_boiler,
            score,
            source_url: p.source_url,
            source_label: p.source_label,
            status: "new",
          });
          if (!error) inserted++;
        }
      }
    }

    // Log heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-prospect-hunter",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { scanned, inserted, updated, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({
        ok: true,
        scanned,
        inserted,
        updated,
        signals: {
          github: githubSignals.length,
          edgar: edgarSignals.length,
          uspto: usptoSignals.length,
          sam: samSignals.length,
          eventbrite: eventbriteSignals.length,
          usaspending: usaSpendingSignals.length,
          linkedin: linkedinSignals.length,
          osha: oshaSignals.length,
          lara_new: laraNewSignals.length,
          lara_dissolved: laraDissolvedSignals.length,
          nlrb: nlrbSignals.length,
          hire_waterfall: waterfallCount,
        },
        duration_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hunter] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
