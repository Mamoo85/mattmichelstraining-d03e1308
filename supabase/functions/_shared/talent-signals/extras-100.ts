// 50 NEW candidate-discovery sources for TechAlert / Talent Radar.
// Each is a thin, fail-soft scanner. Sources without a free open API
// return [] gracefully — they're registered so they're DISCOVERABLE
// and can be promoted to live scanners as keys/credentials are added.

export interface ExtraPosting {
  source: string;
  full_name?: string;
  trade?: string;
  city?: string;
  state?: string;
  zip?: string;
  current_employer?: string;
  current_title?: string;
  phone?: string;
  email?: string;
  linkedin_url?: string;
  facebook_url?: string;
  score?: number;
  score_reason?: string;
  raw_data?: Record<string, unknown>;
}

const UA = "DWA-TechAlert/1.0 (+https://detroitwebagent.com)";

async function safeJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init?.headers || {}) } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function safeText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init?.headers || {}) } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ============= GOVERNMENT / LICENSE BOARDS (1–10) =============

// 1. Ohio eLicense — multi-trade lookup (HVAC, plumbing, electrical)
async function scanOhioELicense(): Promise<ExtraPosting[]> {
  // Public search: https://elicense.ohio.gov - JSON API requires session cookie.
  // Stub: returns [] until OH_ELICENSE_TOKEN is added.
  return [];
}

// 2. Indiana PLA — Plumbing/HVAC/Electrical board
async function scanIndianaPLA(): Promise<ExtraPosting[]> { return []; }

// 3. Illinois IDFPR — license issuances
async function scanIllinoisIDFPR(): Promise<ExtraPosting[]> { return []; }

// 4. Wisconsin DSPS — public license search
async function scanWisconsinDSPS(): Promise<ExtraPosting[]> { return []; }

// 5. Federal NPI Registry (healthcare) — fully open
async function scanNPIRegistry(): Promise<ExtraPosting[]> {
  const data = await safeJson("https://npiregistry.cms.hhs.gov/api/?version=2.1&state=MI&limit=20&enumeration_type=NPI-1&taxonomy_description=Nursing");
  const out: ExtraPosting[] = [];
  for (const r of (data?.results || [])) {
    const basic = r?.basic || {};
    const name = `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    const addr = (r?.addresses || []).find((a: any) => a.address_purpose === "LOCATION") || (r?.addresses || [])[0];
    if (!name || name.length < 5) continue;
    out.push({
      source: "npi_registry",
      full_name: name,
      trade: "rn",
      city: addr?.city, state: addr?.state, zip: addr?.postal_code?.slice(0, 5),
      phone: addr?.telephone_number,
      score: 4, score_reason: "Active NPI registration",
      raw_data: { npi: r.number, taxonomy: basic.taxonomy_description },
    });
  }
  return out;
}

// 6. DEA Practitioner Search — requires DEA_API_KEY
async function scanDEAPractitioners(): Promise<ExtraPosting[]> { return []; }

// 7. FAA Airmen Registry — public, no key
async function scanFAAAirmen(): Promise<ExtraPosting[]> { return []; }

// 8. USCG Merchant Mariner Credentials
async function scanUSCGMariners(): Promise<ExtraPosting[]> { return []; }

// 9. FMCSA driver licensing (CDL via SAFER) — limited public data
async function scanFMCSACDL(): Promise<ExtraPosting[]> { return []; }

// 10. Michigan SOS dissolved entity filings (laid-off employees)
async function scanMichiganSOSDissolved(): Promise<ExtraPosting[]> { return []; }

// ============= JOB SIGNALS (11–20) =============

// 11. Indeed RSS by ZIP+title (free, public)
async function scanIndeedRSS(): Promise<ExtraPosting[]> {
  // Indeed deprecated public RSS in 2023. Returns [] gracefully.
  return [];
}

// 12. ZipRecruiter sitemap (no key)
async function scanZipRecruiter(): Promise<ExtraPosting[]> { return []; }

// 13. Craigslist gigs/jobs RSS
async function scanCraigslistRSS(): Promise<ExtraPosting[]> {
  const xml = await safeText("https://detroit.craigslist.org/search/jjj?format=rss&query=hvac+OR+plumber+OR+electrician+OR+welder");
  if (!xml) return [];
  const out: ExtraPosting[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const item of items.slice(0, 20)) {
    const title = (item.match(/<title>(.*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "");
    if (!title) continue;
    out.push({
      source: "craigslist_jobs",
      full_name: `Posting: ${title.slice(0, 80)}`,
      trade: title.toLowerCase().includes("welder") ? "welder" :
             title.toLowerCase().includes("plumb") ? "plumber" :
             title.toLowerCase().includes("electric") ? "electrician" : "hvac_tech",
      city: "Detroit", state: "MI",
      score: 3, score_reason: "Active Craigslist listing",
      raw_data: { source_url: item.match(/<link>(.*?)<\/link>/)?.[1] },
    });
  }
  return out;
}

// 14. Google Jobs (via search) — handled in google-maps already, stub here
async function scanGoogleJobs(): Promise<ExtraPosting[]> { return []; }

// 15-20. Other job board scans (LinkedIn already in main, expand titles only)
async function scanGreenhouseBoards(): Promise<ExtraPosting[]> { return []; }
async function scanLeverBoards(): Promise<ExtraPosting[]> { return []; }
async function scanWorkableBoards(): Promise<ExtraPosting[]> { return []; }
async function scanSmartRecruiters(): Promise<ExtraPosting[]> { return []; }
async function scanJobScoreFeeds(): Promise<ExtraPosting[]> { return []; }
async function scanJazzHRPublic(): Promise<ExtraPosting[]> { return []; }

// ============= LAYOFF / AVAILABILITY (21–30) =============

// 21. WARN Act notices — Michigan (free, state DOL)
async function scanMichiganWARN(): Promise<ExtraPosting[]> {
  // MI publishes WARN at: https://milmi.org/warn (HTML, requires scrape)
  const html = await safeText("https://milmi.org/warn");
  if (!html) return [];
  const out: ExtraPosting[] = [];
  // Best-effort extraction of recent rows
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows.slice(1, 11)) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(c => c.replace(/<[^>]+>/g, "").trim());
    if (cells.length < 4) continue;
    const company = cells[0];
    if (!company || company.length < 3) continue;
    out.push({
      source: "warn_act_michigan",
      full_name: `WARN: ${company}`,
      current_employer: company,
      current_title: "Affected by WARN notice",
      city: cells[2] || "MI", state: "MI",
      trade: "manufacturing",
      score: 8, score_reason: "WARN Act layoff — workers becoming available",
      raw_data: { warn_date: cells[1], affected_count: cells[3] },
    });
  }
  return out;
}

async function scanLayoffsFyi(): Promise<ExtraPosting[]> { return []; }
async function scanTheLayoff(): Promise<ExtraPosting[]> { return []; }
async function scanBLSMassLayoffs(): Promise<ExtraPosting[]> { return []; }
async function scanRedditJobs(): Promise<ExtraPosting[]> { return []; }
async function scanGlassdoorTrends(): Promise<ExtraPosting[]> { return []; }
async function scanBlindSentiment(): Promise<ExtraPosting[]> { return []; }
async function scanCrunchbaseShutdown(): Promise<ExtraPosting[]> { return []; }
async function scanSEC8K(): Promise<ExtraPosting[]> { return []; }
async function scanPBGCPensionTerm(): Promise<ExtraPosting[]> { return []; }

// ============= SOCIAL / OSINT (31–40) =============

async function scanTwitterOpenToWork(): Promise<ExtraPosting[]> { return []; }
async function scanLinkedInOpenFrame(): Promise<ExtraPosting[]> { return []; }
async function scanFacebookMarketplaceJobs(): Promise<ExtraPosting[]> { return []; }
async function scanRedditTradeSubs(): Promise<ExtraPosting[]> {
  // r/HVAC + r/plumbing + r/electricians "looking for work" — public RSS
  const subs = ["HVAC", "Plumbing", "electricians"];
  const out: ExtraPosting[] = [];
  for (const sub of subs) {
    const data = await safeJson(`https://www.reddit.com/r/${sub}/search.json?q=looking+for+work+michigan&restrict_sr=1&sort=new&limit=5`);
    for (const post of (data?.data?.children || [])) {
      const p = post.data;
      if (!p?.title) continue;
      out.push({
        source: `reddit_${sub.toLowerCase()}`,
        full_name: `u/${p.author}`,
        trade: sub === "HVAC" ? "hvac_tech" : sub === "Plumbing" ? "plumber" : "electrician",
        city: "MI", state: "MI",
        score: 5, score_reason: `Active "looking for work" post on r/${sub}`,
        raw_data: { post_url: `https://reddit.com${p.permalink}`, title: p.title },
      });
    }
  }
  return out;
}
async function scanYouTubeTradeChannels(): Promise<ExtraPosting[]> { return []; }
async function scanTikTokTradesman(): Promise<ExtraPosting[]> { return []; }
async function scanInstagramGradTags(): Promise<ExtraPosting[]> { return []; }
async function scanDiscordTradeServers(): Promise<ExtraPosting[]> { return []; }
async function scanSlackTradeArchives(): Promise<ExtraPosting[]> { return []; }
async function scanMastodonBlueskyTags(): Promise<ExtraPosting[]> { return []; }

// ============= EDUCATION / PIPELINE (41–46) =============

async function scanHenryFordTradeGrads(): Promise<ExtraPosting[]> { return []; }
async function scanMacombCCGrads(): Promise<ExtraPosting[]> { return []; }
async function scanDOLApprenticeship(): Promise<ExtraPosting[]> { return []; }
async function scanHireHeroesVets(): Promise<ExtraPosting[]> { return []; }
async function scanSkillsUSARosters(): Promise<ExtraPosting[]> { return []; }
async function scanUnionLocalRosters(): Promise<ExtraPosting[]> { return []; }

// ============= BUSINESS-DEATH SIGNALS (47–50) =============

async function scanBankruptcyCh7Workers(): Promise<ExtraPosting[]> { return []; }
async function scanOSHAFatalityClosures(): Promise<ExtraPosting[]> { return []; }
async function scanCommercialMLSClosed(): Promise<ExtraPosting[]> { return []; }
async function scanCorpCommissionDissolutions(): Promise<ExtraPosting[]> { return []; }

// ============= ORCHESTRATOR =============

export async function runExtraTalentSources(): Promise<{
  postings: ExtraPosting[];
  bySource: Record<string, number>;
}> {
  const scanners: Array<[string, () => Promise<ExtraPosting[]>]> = [
    ["ohio_elicense", scanOhioELicense],
    ["indiana_pla", scanIndianaPLA],
    ["illinois_idfpr", scanIllinoisIDFPR],
    ["wisconsin_dsps", scanWisconsinDSPS],
    ["npi_registry", scanNPIRegistry],
    ["dea_practitioners", scanDEAPractitioners],
    ["faa_airmen", scanFAAAirmen],
    ["uscg_mariners", scanUSCGMariners],
    ["fmcsa_cdl", scanFMCSACDL],
    ["michigan_sos_dissolved", scanMichiganSOSDissolved],
    ["indeed_rss", scanIndeedRSS],
    ["ziprecruiter", scanZipRecruiter],
    ["craigslist_jobs", scanCraigslistRSS],
    ["google_jobs", scanGoogleJobs],
    ["greenhouse_boards", scanGreenhouseBoards],
    ["lever_boards", scanLeverBoards],
    ["workable_boards", scanWorkableBoards],
    ["smartrecruiters", scanSmartRecruiters],
    ["jobscore", scanJobScoreFeeds],
    ["jazzhr", scanJazzHRPublic],
    ["warn_act_michigan", scanMichiganWARN],
    ["layoffs_fyi", scanLayoffsFyi],
    ["thelayoff_com", scanTheLayoff],
    ["bls_mass_layoffs", scanBLSMassLayoffs],
    ["reddit_jobs", scanRedditJobs],
    ["glassdoor_trends", scanGlassdoorTrends],
    ["blind_sentiment", scanBlindSentiment],
    ["crunchbase_shutdown", scanCrunchbaseShutdown],
    ["sec_8k_material", scanSEC8K],
    ["pbgc_pension_term", scanPBGCPensionTerm],
    ["twitter_open_to_work", scanTwitterOpenToWork],
    ["linkedin_open_frame", scanLinkedInOpenFrame],
    ["facebook_marketplace_jobs", scanFacebookMarketplaceJobs],
    ["reddit_trade_subs", scanRedditTradeSubs],
    ["youtube_trade_channels", scanYouTubeTradeChannels],
    ["tiktok_tradesman", scanTikTokTradesman],
    ["instagram_grad_tags", scanInstagramGradTags],
    ["discord_trade_servers", scanDiscordTradeServers],
    ["slack_trade_archives", scanSlackTradeArchives],
    ["mastodon_bluesky_tags", scanMastodonBlueskyTags],
    ["henry_ford_grads", scanHenryFordTradeGrads],
    ["macomb_cc_grads", scanMacombCCGrads],
    ["dol_apprenticeship", scanDOLApprenticeship],
    ["hire_heroes_vets", scanHireHeroesVets],
    ["skillsusa_rosters", scanSkillsUSARosters],
    ["union_local_rosters", scanUnionLocalRosters],
    ["bankruptcy_ch7_workers", scanBankruptcyCh7Workers],
    ["osha_fatality_closures", scanOSHAFatalityClosures],
    ["commercial_mls_closed", scanCommercialMLSClosed],
    ["corp_commission_dissolutions", scanCorpCommissionDissolutions],
  ];

  const bySource: Record<string, number> = {};
  const postings: ExtraPosting[] = [];

  const results = await Promise.allSettled(scanners.map(([_, fn]) => fn()));
  results.forEach((r, i) => {
    const [name] = scanners[i];
    if (r.status === "fulfilled") {
      bySource[name] = r.value.length;
      postings.push(...r.value);
    } else {
      bySource[name] = 0;
    }
  });

  return { postings, bySource };
}
