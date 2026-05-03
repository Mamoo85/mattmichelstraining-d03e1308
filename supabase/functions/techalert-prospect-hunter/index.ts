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

// Module-level guard so once we get a 402 from Sonar in this run we stop hammering it
let SONAR_DISABLED_REASON: string | null = null;

async function sonarSearch(role: typeof ROLES[number]): Promise<Posting[]> {
  if (!OPENROUTER_API_KEY) return [];
  if (SONAR_DISABLED_REASON) return [];
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
      // 402 = out of credits / payment required. Disable Sonar for the rest of this run
      // so we don't burn time hammering a paid endpoint that will keep saying no.
      if (res.status === 402 || res.status === 429) {
        SONAR_DISABLED_REASON = `HTTP ${res.status}`;
        console.warn(`[hunter] sonar disabled for this run: ${SONAR_DISABLED_REASON}`);
      } else {
        console.error(`[hunter] sonar ${role.key} HTTP ${res.status}`);
      }
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
// SAM.gov Entity Management — federally registered MI trade contractors (pre-qualified, real businesses)
async function scanSAMGovEntities(): Promise<Posting[]> {
  if (!SAM_GOV_API_KEY) return [];
  const results: Posting[] = [];
  // NAICS: 238110=poured concrete, 238210=electrical, 238220=plumbing/HVAC, 238310=drywall, 238910=roofing
  const naicsCodes = [
    { code: "238220", role: "hvac_tech" },
    { code: "238210", role: "electrician" },
    { code: "238110", role: "hvac_tech" },  // concrete = foundation work
    { code: "238910", role: "hvac_tech" },  // roofing
  ];
  for (const { code, role } of naicsCodes) {
    try {
      const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${SAM_GOV_API_KEY}&addressCountryCode=USA&stateOrProvinceCode=MI&primaryNaics=${code}&entityEFTIndicator=Y&registrationStatus=A&purposeOfRegistrationCode=Z2&limit=25`;
      const res = await fetch(url, { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const entity of (data?.entityData || [])) {
        const name: string = entity?.entityRegistration?.legalBusinessName || "";
        const city: string = entity?.coreData?.physicalAddress?.city || "";
        const zip: string = entity?.coreData?.physicalAddress?.zipCode || "";
        if (!name) continue;
        results.push({
          company_name: name,
          city: city ? `${city}, MI${zip ? " " + zip : ""}` : "Michigan",
          role,
          days_posted: null,
          source_url: `https://sam.gov/entity/${entity?.entityRegistration?.ueiSAM}/general-information`,
          source_label: `SAM.gov Entity (NAICS ${code}) — federally registered MI contractor`,
          is_boiler: false,
        });
      }
    } catch (e) {
      console.error("[hunter] sam.gov entities:", e instanceof Error ? e.message : e);
    }
  }
  return results;
}

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
  const queries = [
    "HVAC trade show", "contractor expo michigan", "plumbing electrical conference detroit",
    "home improvement expo michigan", "home show detroit", "remodeling expo michigan",
    "building contractor conference", "construction trade show michigan",
  ];
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

// Michigan LARA — licenses expiring in next 30 days: renewal moment = TechAlert sales opportunity
async function scanLARAExpirations(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    // HVAC/electrical/plumbing/mechanical license type codes
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=ALL&searchType=DATE&dateSearchType=EXPIRATION&dateFrom=${today}&dateTo=${nextMonth}&licenseTypes=2601,2602,2604,2605,2606`;
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
        source_label: "LARA License Expiring (30 days)",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] LARA expirations:", e instanceof Error ? e.message : e); }
  return results;
}

// CFPB Complaint Database — MI home mortgage/improvement complaints: competitor spike = market opening
async function scanCFPBComplaints(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?product=Home+Mortgage&state=MI&date_received_min=${since}&format=json&size=20`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const data = await res.json();
    const companies = new Map<string, number>();
    for (const c of (data?.hits?.hits || [])) {
      const name: string = c?._source?.company ?? "";
      if (!name) continue;
      companies.set(name, (companies.get(name) || 0) + 1);
    }
    for (const [name, count] of companies) {
      if (count < 2) continue; // only surface companies with complaint spikes
      results.push({
        company_name: name,
        city: undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://www.consumerfinance.gov/data-research/consumer-complaints/search/?company=${encodeURIComponent(name)}`,
        source_label: "CFPB Complaints",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] CFPB complaints:", e instanceof Error ? e.message : e); }
  return results;
}

// CourtListener Chapter 7 liquidations — company dissolving = employees available, competitors hiring
async function scanChapter7Liquidations(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.courtlistener.com/api/rest/v3/dockets/?court=mied&date_filed__gte=${since}&nature_of_suit=470&format=json&page_size=20`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const data = await res.json();
    for (const d of (data?.results || [])) {
      const name: string = d?.case_name || "";
      if (!name) continue;
      if (!/(hvac|heat|cool|plumb|electric|mechanical|contractor|construction|services)/i.test(name)) continue;
      results.push({
        company_name: name,
        city: undefined,
        role: "hvac_tech",
        days_posted: null,
        source_url: `https://www.courtlistener.com${d?.absolute_url || ""}`,
        source_label: "Ch.7 Liquidation",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] Chapter 7:", e instanceof Error ? e.message : e); }
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

// Detroit Business Certification Register — city-certified contractors with phone/website
async function scanDetroitCertifiedContractors(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    // NIGP codes: 91x = construction services, 92x = engineering, 76x = demolition/wrecking
    const where = encodeURIComponent(`nigp_code LIKE '%91%' OR nigp_code LIKE '%92%' OR nigp_code LIKE '%76%'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Business_Certification_Register/FeatureServer/0/query?where=${where}&outFields=business_name,authorized_contact_first_name,authorized_contact_last_name,business_phone_number,business_website,business_zip_code,nigp_code,longitude,latitude&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.business_name || "";
      if (!name) continue;
      const city = a.business_zip_code ? `Detroit MI ${a.business_zip_code}` : "Detroit, MI";
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: a.business_website ? `https://${a.business_website.replace(/^https?:\/\//, "")}` : "https://detroitmi.gov/contractors",
        source_label: "Detroit Certified Contractor",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] Detroit certified:", e instanceof Error ? e.message : e); }
  return results;
}

// Currently Open Detroit Businesses — city's pandemic business registry; trade businesses have email+phone
async function scanDetroitOpenTradeBiz(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const tradeFilter = encodeURIComponent(
      `Offers_Services LIKE '%roof%' OR Offers_Services LIKE '%HVAC%' OR Offers_Services LIKE '%plumb%' OR Offers_Services LIKE '%electric%' OR Offers_Services LIKE '%construct%' OR Offers_Services LIKE '%demolit%' OR Offers_Services LIKE '%pest%' OR Offers_Services LIKE '%gutter%'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Currently_Open_Businesses/FeatureServer/0/query?where=${tradeFilter}&outFields=Business_Name,Email,Phone,Website,Clean_Address,Zip_Code,Offers_Services&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.Business_Name || "";
      if (!name || !a.Email) continue; // only use records with email addresses
      const city = a.Zip_Code ? `Detroit MI ${String(a.Zip_Code).split(".")[0]}` : "Detroit, MI";
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: a.Website ? `https://${String(a.Website).replace(/^https?:\/\//, "")}` : "https://detroitmi.gov/opendetroit",
        source_label: "Detroit Open Business Registry",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] Detroit open biz:", e instanceof Error ? e.message : e); }
  return results;
}

// Detroit City Council Business Survey — has is_construction flag + phone + website
async function scanCouncilSurveyedBiz(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const where = encodeURIComponent(`is_construction = 1 OR primary_type_of_service LIKE '%construct%' OR primary_type_of_service LIKE '%HVAC%' OR primary_type_of_service LIKE '%plumb%' OR primary_type_of_service LIKE '%electr%' OR primary_type_of_service LIKE '%roof%'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/council_surveyed_businesses/FeatureServer/0/query?where=${where}&outFields=business_name,business_phone_number,business_website,address,zip_code,primary_type_of_service&resultRecordCount=50&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.business_name || "";
      if (!name) continue;
      const city = a.zip_code ? `Detroit MI ${String(a.zip_code).split(".")[0]}` : "Detroit, MI";
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: a.business_website ? `https://${String(a.business_website).replace(/^https?:\/\//, "")}` : "https://detroitmi.gov/opendetroit",
        source_label: "Detroit Council Business Survey",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] Detroit council surveyed:", e instanceof Error ? e.message : e); }
  return results;
}

// Completed Residential Demolitions — city demo contractors are growing Detroit businesses
async function scanDemoContractors(): Promise<Posting[]> {
  const results: Posting[] = [];
  const seen = new Set<string>();
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Completed_Residential_Demolitions/FeatureServer/0/query?where=1%3D1&outFields=contractor_name,neighborhood&resultRecordCount=100&orderByFields=demolition_date+DESC&f=json",
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.contractor_name || "";
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      results.push({
        company_name: name,
        city: "Detroit, MI",
        role: "hvac_tech",
        days_posted: null,
        source_url: "https://detroitmi.gov/departments/housing-and-revitalization-department/detroit-demolition-program",
        source_label: "Detroit Demolition Contractor (Active City Contract)",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] demo contractors:", e instanceof Error ? e.message : e); }

  // Post-Abatement Verification Reports — demolition + abatement contractors doing city work
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Post_Abatement_Verification_Reports/FeatureServer/0/query?where=posted_timestamp+IS+NOT+NULL&outFields=demo_contractor,contractor,rfp_group&resultRecordCount=100&orderByFields=posted_timestamp+DESC&f=json",
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (res.ok) {
      const d = await res.json();
      for (const feat of (d?.features ?? [])) {
        const a = feat?.attributes ?? {};
        for (const nameField of ["demo_contractor", "contractor"]) {
          const name: string = (a[nameField] || "").trim();
          if (!name || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          results.push({
            company_name: name,
            city: "Detroit, MI",
            role: "hvac_tech",
            days_posted: null,
            source_url: "https://detroitmi.gov/departments/housing-and-revitalization-department/detroit-demolition-program",
            source_label: `Detroit Demo/Abatement Contractor (Post-Abatement Report)`,
            is_boiler: false,
          });
        }
      }
    }
  } catch (e) { console.error("[hunter] post-abatement contractors:", e instanceof Error ? e.message : e); }

  return results;
}

// Demo Pipeline — active RFP bidding groups (contractors bidding these need FieldDesk)
async function scanDemoPipelineRFPs(): Promise<Posting[]> {
  const results: Posting[] = [];
  const seenGroups = new Set<string>();
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Demo_Pipeline/FeatureServer/0/query?where=1%3D1&outFields=demo_rfp_group,neighborhood,commercial_building&resultRecordCount=250&f=json",
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    const rfpGroups = new Map<string, number>();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const group: string = a.demo_rfp_group || "";
      if (!group) continue;
      rfpGroups.set(group, (rfpGroups.get(group) || 0) + 1);
    }
    for (const [group, count] of rfpGroups) {
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
      results.push({
        company_name: `Detroit Demo RFP: ${group} (${count} properties)`,
        city: "Detroit, MI",
        role: "hvac_tech",
        days_posted: null,
        source_url: "https://detroitmi.gov/departments/housing-and-revitalization-department/detroit-demolition-program",
        source_label: "Detroit Active Demolition RFP Bid Group",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] demo pipeline RFPs:", e instanceof Error ? e.message : e); }
  return results;
}

// One-Billion-Dollar affordable housing construction sites — large-scale developers = enterprise targets
async function scanBillionDollarConstruction(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Multifamily_Housing_One_Billion_Dollar_Construction_Sites/FeatureServer/0/query?where=1%3D1&outFields=owner_developer_name,site_name,address,total_units&resultRecordCount=50&f=json",
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.owner_developer_name || a.site_name || "";
      if (!name) continue;
      results.push({
        company_name: name,
        city: "Detroit, MI",
        role: "hvac_tech",
        days_posted: null,
        source_url: "https://detroitmi.gov/housing",
        source_label: `Detroit $1B Housing Developer (${a.total_units ?? "?"} units)`,
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] billion-dollar construction:", e instanceof Error ? e.message : e); }
  return results;
}

// Detroit city procurement contracts — active MI contractors doing city work = growth signal
async function scanDetroitCityContracts(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const keywords = ["construction", "roofing", "HVAC", "demolition", "plumbing", "electrical", "building", "renovation", "restoration", "mechanical", "contractor"];
    const where = encodeURIComponent(
      `(${keywords.map((k) => `description LIKE '%${k}%'`).join(" OR ")}) AND status = 'Open' AND state = 'MI'`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/OCP_Procurement_Contracts/FeatureServer/0/query?where=${where}&outFields=supplier,supp_addr,city,state,amount,description,contract_link&resultRecordCount=50&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.supplier || "";
      if (!name) continue;
      const city = [a.city, a.state].filter(Boolean).join(", ") || "Detroit, MI";
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: a.contract_link || "https://detroitmi.gov/contracts",
        source_label: "Detroit City Contract (Active)",
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] Detroit city contracts:", e instanceof Error ? e.message : e); }
  return results;
}

// Multifamily housing construction sites — active developers building in Detroit = they hire subs
async function scanMultifamilyConstruction(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const where = encodeURIComponent(`construction_status = 'Under Construction'`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/multifamily_housing_construction_sites/FeatureServer/0/query?where=${where}&outFields=owner_developer_name,site_name,address,zip_code,neighborhood,total_units,construction_start_year&resultRecordCount=40&orderByFields=OBJECTID+DESC&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.owner_developer_name || a.site_name || "";
      if (!name) continue;
      const city = a.zip_code ? `Detroit MI ${a.zip_code}` : a.neighborhood ? `Detroit (${a.neighborhood})` : "Detroit, MI";
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: "https://detroitmi.gov/housing",
        source_label: `Detroit Multifamily Construction (${a.total_units ?? "?"} units)`,
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] multifamily construction:", e instanceof Error ? e.message : e); }
  return results;
}

// Detroit active business licenses expiring in 60 days — compliance urgency = TechAlert window
async function scanDetroitBizLicenseExpiry(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(
      `expiration_date >= '${today}' AND expiration_date <= '${in60}' AND (license_category = 'Construction' OR license_category = 'Trade' OR license_type LIKE '%Contractor%' OR license_type LIKE '%HVAC%' OR license_type LIKE '%Electrical%' OR license_type LIKE '%Plumbing%')`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_business_licenses/FeatureServer/0/query?where=${where}&outFields=business_name,address,license_type,license_category,expiration_date,zip_code,neighborhood&resultRecordCount=50&orderByFields=expiration_date+ASC&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const name: string = a.business_name || "";
      if (!name) continue;
      const zip = a.zip_code ? ` ${a.zip_code}` : "";
      const city = `Detroit MI${zip}`;
      const daysUntilExpiry = Math.round((new Date(a.expiration_date).getTime() - Date.now()) / 86400_000);
      results.push({
        company_name: name,
        city,
        role: "hvac_tech",
        days_posted: null,
        source_url: "https://detroitmi.gov/departments/buildings-safety-engineering-and-environment-department",
        source_label: `Detroit Business License Expiring in ${daysUntilExpiry}d (${a.license_type ?? a.license_category})`,
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] biz license expiry:", e instanceof Error ? e.message : e); }
  return results;
}

// Detroit commercial building compliance RED — no CofC, lapsed inspection = compliance crisis = TechAlert window
async function scanCommercialComplianceRed(): Promise<Posting[]> {
  const results: Posting[] = [];
  try {
    const where = encodeURIComponent(
      `commercial_compliance_indicator = 'RED' AND property_class_description IS NOT NULL`,
    );
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_commercial_building_compliance/FeatureServer/0/query?where=${where}&outFields=record_addresses,property_class_description,use_code_description,commercial_compliance_detail,scheduled_inspection_date,council_district&resultRecordCount=30&orderByFields=ObjectId+DESC&f=json`,
      { headers: { "User-Agent": "TechAlert matt@detroitwebagent.com" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const addr: string = (a.record_addresses || "").trim();
      if (!addr) continue;
      const useType = (a.use_code_description || a.property_class_description || "commercial").toLowerCase();
      results.push({
        company_name: addr,
        city: `Detroit MI (District ${a.council_district ?? "?"})`,
        role: "operations_manager",
        days_posted: null,
        source_url: "https://detroitmi.gov/departments/buildings-safety-engineering-and-environment-department",
        source_label: `Detroit Commercial Compliance RED — ${a.commercial_compliance_detail ?? "lapsed inspection"} (${useType})`,
        is_boiler: false,
      });
    }
  } catch (e) { console.error("[hunter] commercial compliance red:", e instanceof Error ? e.message : e); }
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
    const [githubSignals, edgarSignals, usptoSignals, samSignals, samEntitySignals, blsSignals, eventbriteSignals, usaSpendingSignals, linkedinSignals, oshaSignals, laraNewSignals, laraDissolvedSignals, laraExpiringSignals, nlrbSignals, cfpbSignals, ch7Signals, detroitCertifiedSignals, detroitOpenBizSignals, councilSurveyedSignals, detroitCityContractSignals, multifamilySignals, demoContractorSignals, demoPipelineSignals, billionDollarSignals, detroitBizLicenseSignals, commercialRedSignals, weatherBonus, hireWaterfallSignals] = await Promise.all([
      scanGitHubSignals(),
      scanEDGARFundings(),
      scanUSPTOPatents(),
      scanSAMGovContracts(),
      scanSAMGovEntities(),
      scanBLSEmployment(),
      scanEventbriteSignals(),
      scanUSASpending(),
      scanLinkedInJobs(),
      scanOSHAViolations(),
      scanLARANewLicenses(),
      scanLARADissolved(),
      scanLARAExpirations(),
      scanNLRBPetitions(),
      scanCFPBComplaints(),
      scanChapter7Liquidations(),
      scanDetroitCertifiedContractors(),
      scanDetroitOpenTradeBiz(),
      scanCouncilSurveyedBiz(),
      scanDetroitCityContracts(),
      scanMultifamilyConstruction(),
      scanDemoContractors(),
      scanDemoPipelineRFPs(),
      scanBillionDollarConstruction(),
      scanDetroitBizLicenseExpiry(),
      scanCommercialComplianceRed(),
      getWeatherHiringBonus(),
      fetchHireSignals(sb, { state: "MI", naics: "238220" }).catch(() => []),
    ]);
    const supplemental = [...githubSignals, ...edgarSignals, ...usptoSignals, ...samSignals, ...samEntitySignals, ...blsSignals, ...eventbriteSignals, ...usaSpendingSignals, ...linkedinSignals, ...oshaSignals, ...laraNewSignals, ...laraDissolvedSignals, ...laraExpiringSignals, ...nlrbSignals, ...cfpbSignals, ...ch7Signals, ...detroitCertifiedSignals, ...detroitOpenBizSignals, ...councilSurveyedSignals, ...detroitCityContractSignals, ...multifamilySignals, ...demoContractorSignals, ...demoPipelineSignals, ...billionDollarSignals, ...detroitBizLicenseSignals, ...commercialRedSignals];
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
          lara_expiring: laraExpiringSignals.length,
          nlrb: nlrbSignals.length,
          cfpb_complaints: cfpbSignals.length,
          ch7_liquidations: ch7Signals.length,
          detroit_certified: detroitCertifiedSignals.length,
          detroit_open_biz: detroitOpenBizSignals.length,
          council_surveyed: councilSurveyedSignals.length,
          detroit_city_contracts: detroitCityContractSignals.length,
          demo_pipeline_rfps: demoPipelineSignals.length,
          detroit_multifamily: multifamilySignals.length,
          detroit_demo_contractors: demoContractorSignals.length,
          detroit_billion_dollar: billionDollarSignals.length,
          detroit_biz_license_expiry: detroitBizLicenseSignals.length,
          commercial_compliance_red: commercialRedSignals.length,
          sam_entities: samEntitySignals.length,
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
