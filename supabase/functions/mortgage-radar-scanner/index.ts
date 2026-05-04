// Mortgage Radar daily scanner — FCRA-clean pre-trigger mortgage signals
// Sources (all public/behavioral, NOT bureau): BSEED permits, MI SOS new LLCs,
// county foreclosure/lis pendens, FSBO, divorce filings, property-tax cures,
// job changes. Property-level dedup: repeat signals on the same address roll
// up into one lead with a higher score and full signal_history.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS } from "../_shared/twilio.ts";
import { upsertContact, createDeal } from "../_shared/hubspot.ts";
import {
  validateLead,
  quarantineRaw,
  highQuarantineRateAlerts,
  type ScanRunStats,
} from "../_shared/anti-hallucination.ts";
import { scrapeZillowFSBO, scrapeEstateSales } from "../_shared/scrapers-public-listings.ts";
import {
  scrapeForeclosureNotices,
  scrapeProbateFilings,
  scrapeTaxDelinquency,
  scrapeFixerUpperListings,
} from "../_shared/scrapers-county-records.ts";
import { fetchMortgageSignals } from "../_shared/signal-waterfall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const DWA_PHONE = "+13139921219";

function streetViewUrl(address: string, city: string, zip: string): string {
  if (!GOOGLE_MAPS_API_KEY || !address) return "";
  const loc = encodeURIComponent(`${address}, ${city || ""} ${zip || ""}, MI`);
  return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${loc}&fov=80&key=${GOOGLE_MAPS_API_KEY}`;
}



interface RawSignal {
  full_name?: string;
  address?: string;
  city?: string;
  zip?: string;
  county?: string;               // Wayne / Oakland / Macomb / Washtenaw etc.
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  estimated_equity?: number;
  estimated_loan_amount?: number;
  source_id?: string;            // ID in originating table; marked after successful upsert
  source_method?: "llm_search" | "scraper" | "api"; // provenance — drives validation strictness
  // Populated by validateLead() gate before insert. Never trust LLM-supplied lat/lon.
  lat?: number;
  lon?: number;
  formatted_address?: string;
}

// County → Michigan region mapping
const COUNTY_TO_REGION: Record<string, string> = {
  // Southeast Michigan
  Wayne: "Southeast Michigan", Oakland: "Southeast Michigan", Macomb: "Southeast Michigan",
  Washtenaw: "Southeast Michigan", Monroe: "Southeast Michigan", Livingston: "Southeast Michigan",
  "St. Clair": "Southeast Michigan", Lenawee: "Southeast Michigan",
  // West Michigan
  Kent: "West Michigan", Ottawa: "West Michigan", Kalamazoo: "West Michigan",
  Muskegon: "West Michigan", Allegan: "West Michigan", "Van Buren": "West Michigan",
  Berrien: "West Michigan", Cass: "West Michigan", "St. Joseph": "West Michigan",
  // Mid-Michigan
  Ingham: "Mid-Michigan", Eaton: "Mid-Michigan", Genesee: "Mid-Michigan",
  Saginaw: "Mid-Michigan", Bay: "Mid-Michigan", Midland: "Mid-Michigan",
  Clinton: "Mid-Michigan", Shiawassee: "Mid-Michigan", Gratiot: "Mid-Michigan",
  Ionia: "Mid-Michigan", Montcalm: "Mid-Michigan", Isabella: "Mid-Michigan",
  // Northern Michigan
  "Grand Traverse": "Northern Michigan", Emmet: "Northern Michigan",
  Charlevoix: "Northern Michigan", Leelanau: "Northern Michigan",
  Benzie: "Northern Michigan", Otsego: "Northern Michigan", Antrim: "Northern Michigan",
  Manistee: "Northern Michigan", Wexford: "Northern Michigan", Missaukee: "Northern Michigan",
  // East Michigan
  Lapeer: "East Michigan", Tuscola: "East Michigan", Sanilac: "East Michigan",
  Huron: "East Michigan", "St. Clair": "East Michigan",  // St. Clair is SE but overlaps
  // Upper Peninsula
  Marquette: "Upper Peninsula", Chippewa: "Upper Peninsula", Delta: "Upper Peninsula",
  Mackinac: "Upper Peninsula", Luce: "Upper Peninsula", Schoolcraft: "Upper Peninsula",
  Alger: "Upper Peninsula", Baraga: "Upper Peninsula", Houghton: "Upper Peninsula",
  Ontonagon: "Upper Peninsula", Gogebic: "Upper Peninsula", Iron: "Upper Peninsula",
  Dickinson: "Upper Peninsula", Menominee: "Upper Peninsula",
};

// Infer Michigan county from city name — covers the full state.
function inferCounty(city?: string): string | undefined {
  if (!city) return undefined;
  const c = city.toLowerCase().trim();
  // Southeast Michigan — Wayne
  if (/\b(detroit|dearborn heights|dearborn|livonia|westland|taylor|garden city|inkster|romulus|belleville|flat rock|southgate|wyandotte|ecorse|river rouge|lincoln park|melvindale|allen park|trenton|hamtramck|highland park|redford|canton|plymouth|northville|brownstown|woodhaven|riverview|rockwood|gibraltar|grosse pointe)\b/.test(c)) return "Wayne";
  // Southeast Michigan — Oakland
  if (/\b(troy|royal oak|birmingham|bloomfield hills|pontiac|southfield|farmington hills|farmington|novi|ferndale|madison heights|hazel park|clawson|berkley|pleasant ridge|oak park|huntington woods|auburn hills|rochester hills|rochester|milford|highland|commerce|walled lake|wixom|lake orion|waterford|west bloomfield|clarkston|orion|oxford)\b/.test(c)) return "Oakland";
  // Southeast Michigan — Macomb
  if (/\b(sterling heights|warren|clinton township|clinton twp|mount clemens|utica|shelby township|chesterfield|richmond|new baltimore|eastpointe|roseville|st clair shores|saint clair shores|fraser|center line|anchor bay|romeo)\b/.test(c)) return "Macomb";
  // Southeast Michigan — Washtenaw
  if (/\b(ann arbor|ypsilanti|saline|milan|chelsea|dexter|manchester|pittsfield|superior township)\b/.test(c)) return "Washtenaw";
  // Southeast Michigan — Livingston
  if (/\b(brighton|howell|hartland|hamburg|green oak|genoa|pinckney|fowlerville)\b/.test(c)) return "Livingston";
  // Southeast Michigan — Monroe
  if (/\b(monroe|frenchtown|dundee|bedford|temperance|lasalle|petersburg|ida|erie)\b/.test(c)) return "Monroe";
  // Southeast Michigan — St. Clair
  if (/\b(port huron|marysville|st clair|saint clair|port huron township|clay|east china|fort gratiot|kimball|algonac)\b/.test(c)) return "St. Clair";
  // Southeast Michigan — Lenawee
  if (/\b(adrian|tecumseh|blissfield|morenci|hudson|onsted|addison|madison|jasper)\b/.test(c)) return "Lenawee";
  // West Michigan — Kent
  if (/\b(grand rapids|kentwood|wyoming|walker|grandville|east grand rapids|forest hills|rockford|lowell|ada|cascade|caledonia|byron center|comstock park)\b/.test(c)) return "Kent";
  // West Michigan — Ottawa
  if (/\b(holland|grand haven|zeeland|hudsonville|coopersville|spring lake|ferrysburg|allendale|jenison|west olive|nunica)\b/.test(c)) return "Ottawa";
  // West Michigan — Kalamazoo
  if (/\b(kalamazoo|portage|oshtemo|texas township|comstock|richland|vicksburg|parchment)\b/.test(c)) return "Kalamazoo";
  // West Michigan — Muskegon
  if (/\b(muskegon|norton shores|muskegon heights|fruitport|north muskegon|whitehall|montague|ravenna|twin lake)\b/.test(c)) return "Muskegon";
  // West Michigan — Allegan
  if (/\b(allegan|saugatuck|douglas|fennville|plainwell|wayland|otsego|martin|hamilton)\b/.test(c)) return "Allegan";
  // West Michigan — Van Buren
  if (/\b(south haven|bangor|lawrence|paw paw|gobles|covert|decatur)\b/.test(c)) return "Van Buren";
  // West Michigan — Berrien
  if (/\b(benton harbor|st joseph|saint joseph|niles|buchanan|stevensville|bridgman|coloma|watervliet|new buffalo|baroda)\b/.test(c)) return "Berrien";
  // Mid-Michigan — Ingham
  if (/\b(lansing|east lansing|meridian|haslett|williamston|mason|okemos|holt|delhi|leslie)\b/.test(c)) return "Ingham";
  // Mid-Michigan — Eaton
  if (/\b(charlotte|grand ledge|delta township|eaton rapids|olivet|mulliken|vermontville)\b/.test(c)) return "Eaton";
  // Mid-Michigan — Genesee
  if (/\b(flint|burton|grand blanc|flushing|davison|swartz creek|clio|fenton|linden|mount morris|atlas|mundy)\b/.test(c)) return "Genesee";
  // Mid-Michigan — Saginaw
  if (/\b(saginaw|saginaw township|thomas township|tittabawassee|chesaning|birch run|frankenmuth)\b/.test(c)) return "Saginaw";
  // Mid-Michigan — Bay
  if (/\b(bay city|essexville|hampton|pinconning|monitor|bangor township|fraser township)\b/.test(c)) return "Bay";
  // Mid-Michigan — Midland
  if (/\b(midland|sanford|coleman|hope|larkin)\b/.test(c)) return "Midland";
  // Mid-Michigan — Clinton
  if (/\b(st johns|saint johns|dewitt|bath|ovid|fowler|westphalia)\b/.test(c)) return "Clinton";
  // Mid-Michigan — Isabella
  if (/\b(mount pleasant|alma|gratiot|shepherd|winn|rosebush)\b/.test(c)) return "Isabella";
  // Northern Michigan — Grand Traverse
  if (/\b(traverse city|garfield|acme|blair|east bay|paradise|long lake)\b/.test(c)) return "Grand Traverse";
  // Northern Michigan — Emmet
  if (/\b(petoskey|harbor springs|conway|harbor|bliss|littlefield|readmond)\b/.test(c)) return "Emmet";
  // Northern Michigan — Charlevoix
  if (/\b(charlevoix|boyne city|east jordan|boyne falls|beaver island|horton bay)\b/.test(c)) return "Charlevoix";
  // Northern Michigan — Leelanau
  if (/\b(leland|suttons bay|northport|lake leelanau|maple city|cedar|empire|glen arbor)\b/.test(c)) return "Leelanau";
  // East Michigan — Lapeer
  if (/\b(lapeer|imlay city|dryden|clifford|columbiaville|metamora|attica)\b/.test(c)) return "Lapeer";
  // East Michigan — Tuscola
  if (/\b(caro|vassar|cass city|millington|gagetown|akron|reese)\b/.test(c)) return "Tuscola";
  // East Michigan — Sanilac
  if (/\b(sandusky|marlette|bad axe|port sanilac|forester|lexington)\b/.test(c)) return "Sanilac";
  // East Michigan — Huron
  if (/\b(bad axe|harbor beach|caseville|sebewaing|pigeon|ubly)\b/.test(c)) return "Huron";
  // Upper Peninsula — Marquette
  if (/\b(marquette|ishpeming|negaunee|republic|gwinn|champion)\b/.test(c)) return "Marquette";
  // Upper Peninsula — Chippewa
  if (/\b(sault ste marie|sault sainte marie|kinross|pickford|rudyard|dafter|brimley)\b/.test(c)) return "Chippewa";
  // Upper Peninsula — Delta
  if (/\b(escanaba|gladstone|ford river|rapid river|garden)\b/.test(c)) return "Delta";
  // Upper Peninsula — Mackinac
  if (/\b(st ignace|saint ignace|mackinac island|mackinaw city|brevort|naubinway)\b/.test(c)) return "Mackinac";
  return undefined;
}

function inferRegion(county?: string): string | undefined {
  if (!county) return undefined;
  return COUNTY_TO_REGION[county];
}

const BASE_SCORES: Record<string, number> = {
  renovation_permit: 9,
  kitchen_addition_permit: 9,
  fsbo_listing: 8,
  lis_pendens: 9,
  foreclosure_notice: 9,
  divorce_filing: 7,
  new_llc_self_employed: 6,
  property_tax_cure: 7,
  high_equity_low_rate: 6,
  job_change_high_income: 7,
  probate_filing: 8,
  estate_sale: 7,
  tax_delinquency: 8,
  fixer_upper_listing: 7,
  sba_loan_approved: 6,
};

const OPENERS: Record<string, { opener: string; window: string }> = {
  renovation_permit: {
    opener: "Hey {name} — saw the permit on the {address} project. A lot of folks doing this size of reno are pulling cash out instead of using a HELOC. Happy to run numbers on both, no pressure.",
    window: "11am–1pm or 5pm–7pm",
  },
  fsbo_listing: {
    opener: "Hi {name} — saw your home is for sale by owner. When the next purchase comes around I help local buyers structure financing and lock in rates early. Worth 5 min when you're ready?",
    window: "5pm–8pm weekdays / weekends",
  },
  lis_pendens: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  foreclosure_notice: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  divorce_filing: {
    opener: "Hi {name} — when something like this comes up, the mortgage piece is usually the last thing handled. I can quietly pre-qualify you for a buyout refi so you have options on the table.",
    window: "lunch hour or 6pm+",
  },
  new_llc_self_employed: {
    opener: "Hi {name} — congrats on the new business. Most lenders want 2 yrs of self-employed tax returns; I work with bank-statement loans that get around that. Want me to run numbers?",
    window: "10am–noon",
  },
  property_tax_cure: {
    opener: "Hi {name} — saw the tax position get cured. If the cash came out of savings and you'd rather rebuild reserves, a quick cash-out refi might make sense. 5 min call?",
    window: "5pm–7pm",
  },
  high_equity_low_rate: {
    opener: "Hi {name} — your home has a lot of trapped equity right now. If you're sitting on a sub-4 rate I have a couple of HELOC options that don't touch the first mortgage.",
    window: "afternoon",
  },
  job_change_high_income: {
    opener: "Hi {name} — congrats on the move. New role often means relocation or a step-up purchase. I help structure financing before the listing rush. Worth 10 min?",
    window: "lunch or evening",
  },
  probate_filing: {
    opener: "Hi {name} — I work with families who inherited property and aren't sure of the best path forward financially. Whether that's a sale, a buyout, or an estate refi — I can walk through the options quietly. No rush.",
    window: "10am–noon or 6pm+",
  },
  estate_sale: {
    opener: "Hi {name} — saw the estate sale at {address}. If there's real property involved in the estate, I work with families on financing the transition — buyout, bridge, or cash-out. Worth a quick call?",
    window: "10am–2pm",
  },
  tax_delinquency: {
    opener: "Hi {name} — I work with homeowners who need to restructure their position fast. A cash-out refi can often clear tax delinquency and rebuild cushion at the same time. Can I run the numbers for you?",
    window: "9am–11am",
  },
  fixer_upper_listing: {
    opener: "Hi {name} — saw the listing on {address}. Buyers of fixer-uppers often use renovation loans (203k or Fannie HomeStyle) that roll purchase and rehab into one payment. Happy to explain if that's useful.",
    window: "5pm–8pm weekdays / weekends",
  },
  sba_loan_approved: {
    opener: "Hi {name} — congrats on the SBA approval. A lot of new business owners don't realize they can still qualify for a home purchase using bank-statement or business-bank lending programs even with a new LLC. Worth knowing about.",
    window: "10am–noon",
  },
};

function scoreFor(signal_type: string): number {
  return BASE_SCORES[signal_type] ?? 5;
}

function openerFor(signal_type: string): { opener: string; window: string } {
  return OPENERS[signal_type] ?? {
    opener: "Hi {name} — saw a public record on {address} and thought it might be worth a quick mortgage chat.",
    window: "10am–6pm local",
  };
}

// === SOURCES ===

async function scanBSEEDPermits(): Promise<RawSignal[]> {
  try {
    // Real field names verified against ArcGIS schema (lowercase)
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,permit_type,work_description,issued_date,contact_business_name&resultRecordCount=100&f=json&orderByFields=issued_date+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const desc = String(a.work_description || "").toLowerCase();
      const isReno = /kitchen|addition|remodel|bath|whole house|finish basement|roof/.test(desc);
      if (!isReno) continue;
      out.push({
        address: a.address || "",
        city: "Detroit",
        county: "Wayne",
        zip: String(a.zip_code || "").slice(0, 5) || undefined,
        signal_type: "renovation_permit",
        signal_source: "BSEED",
        signal_detail: String(a.work_description || "Renovation permit").slice(0, 200),
        signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : undefined,
      });
    }
    return out.slice(0, 50);
  } catch (e) {
    console.warn("[scanBSEEDPermits]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// DEPRECATED: sonarSearch (Gemini free-form JSON) was retired Phase 25.
// All LLM extraction now goes through extractLeadsFromSource() + verifyClaims()
// in _shared/lead-extractor.ts and _shared/lead-verifier.ts. This shim exists
// only so legacy call sites compile; it ALWAYS returns [].
// New pipeline: caller must fetch source text deterministically (Firecrawl/HTTP),
// then run extractor → verifier → corroboration before persisting.
async function sonarSearch(_prompt: string, _schemaHint: string): Promise<any[]> {
  console.warn("[sonarSearch] deprecated — use extractor/verifier pipeline. Returning [].");
  return [];
}

// Phase C: deterministic scrape of Detroit/Oakland/Macomb Legal News public foreclosure notices.
// Replaces Sonar/Perplexity LLM discovery — every address is on a real, fetched legal-notice page.
async function scanForeclosureNotices(): Promise<RawSignal[]> {
  const items = await scrapeForeclosureNotices({ perSourceCap: 8 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase B: deterministic Firecrawl scrape of Zillow FSBO city pages.
// Replaces LLM "discovery" — every address comes from a real Zillow page.
async function scanFSBOListings(): Promise<RawSignal[]> {
  const items = await scrapeZillowFSBO({ perCityCap: 5 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

async function scanDivorceFilings(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent (last 30 days) divorce / dissolution-of-marriage filings in Wayne, Oakland, or Macomb County Michigan circuit court public records. Include petitioner name, last-known property address if available, city, ZIP, filing date, source URL.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_date": "YYYY-MM-DD", "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "divorce_filing",
    signal_source: "CircuitCourt",
    signal_detail: i.signal_detail || "Divorce filing",
    signal_url: i.signal_url || undefined,
    signal_date: i.signal_date || undefined,
    source_method: "llm_search",
  })).filter(s => s.address);
}

// DATA SOURCE: BSEED ArcGIS — Detroit Open Data. Filters for high-cost permits
// (estimated construction value >= $100k). Large-dollar projects signal homeowners
// with significant equity who may want cash-out refi instead of draining savings.
async function scanHighEquityLowRate(): Promise<RawSignal[]> {
  try {
    // bseed_building_permits has amt_estimated_contractor_cost — correct layer for cost filtering
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=amt_estimated_contractor_cost+%3E%3D+25000&outFields=address,zip_code,work_description,issued_date,amt_estimated_contractor_cost&resultRecordCount=30&f=json&orderByFields=issued_date+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const cost = Number(a.amt_estimated_contractor_cost || 0);
      if (cost < 25000) continue;
      const desc = String(a.work_description || "Major renovation").slice(0, 200);
      out.push({
        address: a.address || undefined,
        city: "Detroit",
        county: "Wayne",
        zip: String(a.zip_code || "").slice(0, 5) || undefined,
        signal_type: "high_equity_renovation",
        signal_source: "BSEED_HighValue",
        signal_detail: `$${cost.toLocaleString()} permit — ${desc}`,
        signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : undefined,
        estimated_equity: Math.round(cost * 2.5),
      });
    }
    return out.slice(0, 20);
  } catch (e) {
    console.warn("[scanHighEquityLowRate]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanNewMichiganLLCs(sb: ReturnType<typeof createClient>): Promise<RawSignal[]> {
  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data } = await (sb.from as any)("industry_pulse_signals")
      .select("id, business_name, city, created_at")
      .eq("signal_type", "new_business")
      .gte("created_at", since)
      .is("pitched_mortgage_radar_at", null)
      .order("created_at", { ascending: false })
      .limit(25);
    const out: RawSignal[] = [];
    for (const row of (data || [])) {
      const city = row.city || "Metro Detroit";
      const biz = row.business_name || "Unknown Business";
      out.push({
        full_name: biz,
        address: `${biz}, ${city}`,
        city,
        county: inferCounty(city),
        signal_type: "new_llc_self_employed",
        signal_source: "MI_SOS",
        signal_detail: `New LLC: ${biz} — self-employed owner may need bank-statement or DSCR loan`,
        signal_date: row.created_at?.slice(0, 10),
        source_id: row.id,
      });
    }
    return out;
  } catch (e) {
    console.warn("[scanNewMichiganLLCs]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanJobChanges(): Promise<RawSignal[]> { return []; }

// Phase C: deterministic scrape of probate court public notices via Legal News.
async function scanProbateFilings(): Promise<RawSignal[]> {
  const items = await scrapeProbateFilings({ perSourceCap: 6 });
  return items.map((i) => ({
    full_name: i.full_name,
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase B: deterministic Firecrawl scrape of EstateSales.net MI city pages.
async function scanEstateSales(): Promise<RawSignal[]> {
  const items = await scrapeEstateSales({ perCityCap: 4 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase C: deterministic county-treasurer foreclosure/forfeiture list scrape.
async function scanTaxDelinquency(): Promise<RawSignal[]> {
  const items = await scrapeTaxDelinquency({ perSourceCap: 10 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase C: deterministic Zillow keyword-search scrape (fixer-upper / handyman-special).
async function scanFixerUpperListings(): Promise<RawSignal[]> {
  const items = await scrapeFixerUpperListings({ perSourceCap: 5 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// SBA loan approvals via USASpending.gov — new self-employed owner who just got capital
// needs a home purchase or HELOC. USASpending is the verified working federal API.
async function scanSBAApprovals(): Promise<RawSignal[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const body = {
      subawards: false,
      page: 1,
      limit: 50,
      sort: "Issued Date",
      order: "desc",
      fields: ["Award ID", "Recipient Name", "Loan Value", "Issued Date", "recipient_location_city_name", "recipient_location_state_code", "recipient_location_address_line1"],
      filters: {
        award_type_codes: ["08"], // SBA loan guarantees
        place_of_performance_locations: [{ country: "USA", state: "MI" }],
        time_period: [{ start_date: cutoff, end_date: new Date().toISOString().slice(0, 10) }],
      },
    };
    const r = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    // Normalize: USASpending API may return results under different keys
    const rawArr = j?.results ?? j?.data ?? j?.awards ?? [];
    const records: any[] = Array.isArray(rawArr) ? rawArr : [];
    if (!records.length && j) {
      console.warn("[scanSBAApprovals] Ingestion Pipeline — unexpected response shape, keys:", Object.keys(j).slice(0, 8).join(","));
    }
    const metro = /detroit|dearborn|livonia|warren|sterling|troy|pontiac|southfield|ann arbor|canton|westland|farmington|royal oak|grosse pointe|hamtramck/i;
    return records
      .filter((rec: any) => metro.test(rec.recipient_location_city_name || rec.city || "") && Number(rec["Loan Value"] ?? rec.loan_value ?? rec.award_amount ?? 0) >= 50_000)
      .map((rec: any) => ({
        full_name: rec["Recipient Name"] ?? rec.recipient_name ?? rec.awardee_name ?? undefined,
        address: rec.recipient_location_address_line1 ?? rec.address ?? "",
        city: rec.recipient_location_city_name || undefined,
        county: inferCounty(rec.recipient_location_city_name),
        signal_type: "sba_loan_approved",
        signal_source: "USASpending",
        signal_detail: `SBA loan: $${Number(rec["Loan Value"] || 0).toLocaleString()} approved for ${rec["Recipient Name"] || "business"} in ${rec.recipient_location_city_name || "MI"}`,
        signal_date: rec["Issued Date"] ? String(rec["Issued Date"]).slice(0, 10) : undefined,
        estimated_loan_amount: rec["Loan Value"] ? Math.round(Number(rec["Loan Value"]) * 0.7) : undefined,
      }))
      .filter((s: RawSignal) => s.address)
      .slice(0, 30);
  } catch (e) {
    console.warn("[scanSBAApprovals]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function notifyClients(sb: ReturnType<typeof createClient>, zip: string | undefined, county: string | undefined, score: number): Promise<string[]> {
  if (score < 7) return [];
  const region = inferRegion(county);
  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, zip_codes, coverage_counties, coverage_regions")
    .eq("active", true);
  const matched = (clients || []).filter((c: any) => {
    // Region match (broadest — try first)
    if (region && Array.isArray(c.coverage_regions) && c.coverage_regions.length > 0) {
      if (c.coverage_regions.includes(region)) return true;
    }
    // County match (medium)
    if (county && Array.isArray(c.coverage_counties) && c.coverage_counties.length > 0) {
      if (c.coverage_counties.includes(county)) return true;
    }
    // Zip match (narrowest fallback)
    return zip && Array.isArray(c.zip_codes) && c.zip_codes.includes(zip);
  });
  return matched.map((c: any) => c.id);
}

// Property-level dedup: address + zip is the unique key.
// If the same property emits a new signal type, score is bumped (capped 10),
// and the new signal is appended to signal_history.
async function upsertWithDedup(sb: ReturnType<typeof createClient>, s: RawSignal): Promise<{ id: string; created: boolean } | null> {
  if (!s.address) return null;
  // Phase B trust gate: LLM-only-sourced leads are capped at 3 until a 2nd source confirms.
  // Deterministic scrapers + APIs use full base score immediately.
  const rawBase = scoreFor(s.signal_type);
  const baseScore = s.source_method === "llm_search" ? Math.min(3, rawBase) : rawBase;
  const { opener, window } = openerFor(s.signal_type);

  const lookupAddress = s.address.toLowerCase();
  const { data: existing } = await (sb.from as any)("mortgage_radar_leads")
    .select("id, score, signal_count, signal_history, signal_type")
    .eq("zip", s.zip || "")
    .ilike("address", s.address)
    .maybeSingle();

  if (existing) {
    // Same property, new signal — bump score, append history (only if signal type is new or > 30 days old)
    const history: any[] = Array.isArray(existing.signal_history) ? existing.signal_history : [];
    const alreadyLogged = history.some((h: any) =>
      h.signal_type === s.signal_type &&
      h.signal_date === (s.signal_date || null)
    );
    if (alreadyLogged) return { id: existing.id, created: false };

    history.push({
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    });

    // Repeat signal on same property = stronger intent. Bump by +1, capped at 10.
    const newScore = Math.min(10, Math.max(existing.score, baseScore) + 1);

    await (sb.from as any)("mortgage_radar_leads")
      .update({
        score: newScore,
        signal_count: (existing.signal_count || 1) + 1,
        signal_history: history,
        last_signal_at: new Date().toISOString(),
        // Keep latest signal as the "headline"
        signal_type: s.signal_type,
        signal_source: s.signal_source,
        signal_detail: s.signal_detail || null,
        signal_url: s.signal_url || null,
        signal_date: s.signal_date || null,
        suggested_opener: opener,
        best_call_window: window,
      })
      .eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  // New property — insert
  const row = {
    full_name: s.full_name || null,
    address: s.formatted_address || s.address,
    city: s.city || null,
    state: "MI",
    zip: s.zip || null,
    county: s.county || null,
    region: s.county ? inferRegion(s.county) || null : null,
    signal_type: s.signal_type,
    signal_source: s.signal_source,
    signal_detail: s.signal_detail || null,
    signal_url: s.signal_url || null,
    signal_date: s.signal_date || null,
    estimated_equity: s.estimated_equity || null,
    estimated_loan_amount: s.estimated_loan_amount || null,
    score: baseScore,
    signal_count: 1,
    last_signal_at: new Date().toISOString(),
    signal_history: [{
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    }],
    suggested_opener: opener,
    best_call_window: window,
    // Use validated coordinates for Street View when available — kills the fuzzy-match bug.
    street_view_url: s.lat != null && s.lon != null && GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${s.lat},${s.lon}&fov=80&key=${GOOGLE_MAPS_API_KEY}`
      : streetViewUrl(s.address || "", s.city || "", s.zip || ""),
    lat: s.lat ?? null,
    lon: s.lon ?? null,
    raw: s as unknown as Record<string, unknown>,
  };
  const { data: ins, error } = await (sb.from as any)("mortgage_radar_leads")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    // Race: another concurrent insert. Fall back to upsert lookup.
    if (String(error.message || "").includes("duplicate")) {
      const { data: again } = await (sb.from as any)("mortgage_radar_leads")
        .select("id").eq("zip", s.zip || "").ilike("address", s.address).maybeSingle();
      return again ? { id: again.id, created: false } : null;
    }
    console.warn("[upsertWithDedup] insert error:", error.message);
    return null;
  }
  // Mirror new lead to HubSpot (homeowner pipeline) — non-blocking
  if (ins?.id) {
    try {
      const dealName = `${s.formatted_address || s.address} — ${s.signal_type}`;
      const contactId = s.full_name
        ? await upsertContact({
            email: `${ins.id}@mortgage-radar.dwa.local`, // placeholder unique key (no homeowner email yet)
            firstname: s.full_name.split(" ")[0],
            lastname: s.full_name.split(" ").slice(1).join(" ") || undefined,
            company: s.address || undefined,
            dwa_signal_source: "mortgage_radar",
          })
        : null;
      await createDeal(
        {
          dealname: dealName,
          amount: s.estimated_loan_amount || s.estimated_equity || undefined,
          pipeline: "default",
          dealstage: "qualifiedtobuy",
          dwa_signal_source: "mortgage_radar",
          dwa_signal_type: s.signal_type,
          dwa_address: s.formatted_address || s.address,
          dwa_zip: s.zip || undefined,
        },
        contactId ? { contactId } : undefined,
      );
    } catch (e) {
      console.warn("[mortgage-radar→hubspot]", e instanceof Error ? e.message : e);
    }
  }
  return ins ? { id: ins.id, created: true } : null;
}


// ── NEW SOURCES ──────────────────────────────────────────────────────────────

// #7-expanded — EstateSales.net: broader MI city coverage (was capped at 4 Detroit)
async function scanEstateSalesExpanded(): Promise<RawSignal[]> {
  // scrapeEstateSales already handles multiple cities; bump cap to 8 and cover Oakland/Macomb
  const items = await scrapeEstateSales({ perCityCap: 8 });
  return items.map((i) => ({
    address: i.address, city: i.city,
    county: i.county || inferCounty(i.city),
    zip: i.zip, signal_type: i.signal_type,
    signal_source: i.signal_source, signal_detail: i.signal_detail,
    signal_url: i.signal_url, signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// #5 — LARA new LLC filings via Firecrawl (deterministic scrape, no LLM discovery).
// Target: Michigan SOS Corporations Division search for new entities in last 7 days.
// Anti-hallucination: source_method="scraper", every address goes through validateLead().
async function scanLARANewLLCs(): Promise<RawSignal[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=ALL&searchType=DATE&dateSearchType=FORMATION&dateFrom=" +
          new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "%2F") +
          "&dateTo=" + new Date().toISOString().slice(0, 10).replace(/-/g, "%2F"),
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              entities: {
                type: "array", maxItems: 30,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    city: { type: "string" },
                    type: { type: "string" },
                    id: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          prompt: "Extract the list of newly formed Michigan business entities. Return name, city, entity type, and ID for each. Only include LLC, PLLC, or sole proprietorship entities.",
        },
        timeout: 15000,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const entities: any[] = j?.data?.extract?.entities || [];
    const out: RawSignal[] = [];
    for (const e of entities) {
      const city = e.city || "Michigan";
      // Only include SE Michigan / metro areas — out-of-state or rural entities are noise
      const county = inferCounty(city);
      if (!county) continue;
      out.push({
        full_name: e.name || undefined,
        address: `${e.name || "New LLC"}, ${city}, MI`,
        city,
        county,
        signal_type: "new_llc_self_employed",
        signal_source: "LARA_SOS",
        signal_detail: `New ${e.type || "LLC"}: ${e.name} — self-employed owner may need bank-statement loan`,
        signal_date: new Date().toISOString().slice(0, 10),
        source_method: "scraper" as const,
      });
    }
    return out.slice(0, 25);
  } catch (e) {
    console.warn("[scanLARANewLLCs]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// #1 — Wayne County Register of Deeds: lis pendens + deed transfers via public search.
// Uses Firecrawl to hit the public portal; every address validated through validateLead().
// Anti-hallucination: deterministic scrape, no LLM free-form generation.
async function scanWayneCountyDeeds(): Promise<RawSignal[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://register.waynecounty.com/PublicRecordsSearch",
        formats: ["extract"],
        actions: [
          { type: "click", selector: "#docType" },
          { type: "select", selector: "#docType", value: "LIS PENDENS" },
          { type: "click", selector: "#searchBtn" },
          { type: "wait", milliseconds: 2000 },
        ],
        extract: {
          schema: {
            type: "object",
            properties: {
              records: {
                type: "array", maxItems: 20,
                items: {
                  type: "object",
                  properties: {
                    grantor: { type: "string" },
                    address: { type: "string" },
                    city: { type: "string" },
                    doc_date: { type: "string" },
                  },
                },
              },
            },
          },
          prompt: "Extract the list of lis pendens or foreclosure deed records shown. Return grantor name (homeowner), property address, city, and document date.",
        },
        timeout: 20000,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const records: any[] = j?.data?.extract?.records || [];
    return records
      .filter(r => r.address && r.address.length > 5)
      .map(r => ({
        full_name: r.grantor || undefined,
        address: r.address,
        city: r.city || "Detroit",
        county: "Wayne",
        signal_type: "lis_pendens",
        signal_source: "WayneCountyROD",
        signal_detail: `Lis pendens recorded${r.grantor ? ` — homeowner: ${r.grantor}` : ""}`,
        signal_date: r.doc_date || undefined,
        source_method: "scraper" as const,
      }))
      .slice(0, 15);
  } catch (e) {
    console.warn("[scanWayneCountyDeeds]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// #2 — Oakland County permit feed via BS&A Online (public portal, no auth required).
// Anti-hallucination: deterministic scrape → validateLead() address check.
async function scanOaklandCountyPermits(): Promise<RawSignal[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://bsaonline.com/SiteSearch/SiteSearchIndex?redirect=no&SearchCategory=Permits&SearchText=renovation&county=Oakland",
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              permits: {
                type: "array", maxItems: 20,
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    city: { type: "string" },
                    description: { type: "string" },
                    issued_date: { type: "string" },
                    estimated_cost: { type: "number" },
                  },
                  required: ["address"],
                },
              },
            },
          },
          prompt: "Extract building permit records shown. Return address, city, permit description, issued date, and estimated cost. Only include permits with estimated cost >= $25,000 or that describe kitchen, bathroom, addition, or remodel work.",
        },
        timeout: 15000,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const permits: any[] = j?.data?.extract?.permits || [];
    return permits
      .filter(p => p.address && p.address.length > 5)
      .map(p => ({
        address: p.address,
        city: p.city || "Oakland County",
        county: inferCounty(p.city) || "Oakland",
        signal_type: "renovation_permit",
        signal_source: "OaklandCountyPermits",
        signal_detail: `${p.description || "Renovation permit"}${p.estimated_cost ? ` — $${Number(p.estimated_cost).toLocaleString()} est.` : ""}`,
        signal_date: p.issued_date || undefined,
        estimated_equity: p.estimated_cost ? Math.round(p.estimated_cost * 2.5) : undefined,
        source_method: "scraper" as const,
      }))
      .slice(0, 15);
  } catch (e) {
    console.warn("[scanOaklandCountyPermits]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// #3 — Realtor.com price-reduced listings via Firecrawl (no API key required for public pages).
// Price reduction >= 5% after 30+ days on market = motivated seller = also a future buyer.
// Anti-hallucination: deterministic URL scrape, every address through validateLead().
async function scanPriceReductions(): Promise<RawSignal[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    // Target: Realtor.com SE Michigan price-reduced listings, sorted by newest reduction
    const url = "https://www.realtor.com/realestateandhomes-search/Michigan/price-reduced?state=MI";
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              listings: {
                type: "array", maxItems: 15,
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    city: { type: "string" },
                    zip: { type: "string" },
                    days_on_market: { type: "number" },
                    price_reduction_pct: { type: "number" },
                    list_price: { type: "number" },
                  },
                  required: ["address"],
                },
              },
            },
          },
          prompt: "Extract price-reduced listings. Return address, city, zip, days on market, price reduction percentage, and list price. Only include listings where days_on_market >= 20 or price_reduction_pct >= 5.",
        },
        timeout: 15000,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const listings: any[] = j?.data?.extract?.listings || [];
    return listings
      .filter(l => {
        const county = inferCounty(l.city);
        return county && l.address && l.address.length > 5;
      })
      .map(l => ({
        address: l.address,
        city: l.city,
        county: inferCounty(l.city),
        zip: l.zip,
        signal_type: "fsbo_listing",
        signal_source: "RealtorCom_PriceReduced",
        signal_detail: `Price reduced${l.price_reduction_pct ? ` ${l.price_reduction_pct}%` : ""} after ${l.days_on_market || "30"}+ days — motivated seller${l.list_price ? `, asking $${Math.round(l.list_price / 1000)}k` : ""}`,
        estimated_equity: l.list_price ? Math.round(l.list_price * 0.25) : undefined,
        source_method: "scraper" as const,
      }))
      .slice(0, 10);
  } catch (e) {
    console.warn("[scanPriceReductions]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// BSEED Pre-Sale Inspections — homes being inspected before listing = imminent transactions
async function scanPresaleInspections(): Promise<RawSignal[]> {
  const results: RawSignal[] = [];
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_presale_inspections/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,inspection_date,inspection_type,inspection_result,neighborhood&resultRecordCount=50&orderByFields=ObjectId+DESC&f=json",
      { headers: { "User-Agent": "DWA-MortgageRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const addr: string = a.address ?? "";
      const zip: string = a.zip_code ?? "";
      if (!addr) continue;
      results.push({
        address: addr,
        city: "Detroit",
        zip,
        signal_type: "fsbo_presale",
        signal_source: "BSEED_Presale",
        signal_detail: `BSEED Pre-Sale Inspection: ${a.inspection_type ?? "presale"} at ${addr} (result: ${a.inspection_result ?? "pending"}) — home entering market. Sellers often need cash-out refi to fund repairs before listing`,
        signal_url: undefined,
        signal_date: a.inspection_date ? new Date(a.inspection_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
      });
    }
  } catch (e) { console.warn("[scanner] BSEED presale:", e instanceof Error ? e.message : e); }
  return results;
}

// DLBA For Sale — investors buying vacant DLBA properties often need renovation loans
async function scanDLBAForSale(): Promise<RawSignal[]> {
  const results: RawSignal[] = [];
  try {
    const res = await fetch(
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/DLBA_For_Sale/FeatureServer/0/query?where=1%3D1&outFields=address,neighborhood,listing_date,program&resultRecordCount=40&orderByFields=listing_date+DESC&f=json",
      { headers: { "User-Agent": "DWA-MortgageRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const addr = [a.street_number, a.street_direction, a.street_name, a.street_type].filter(Boolean).join(" ").trim() || a.address || "";
      if (!addr) continue;
      results.push({
        address: addr,
        city: "Detroit",
        zip: "",
        signal_type: "fixer_upper",
        signal_source: "DLBA_For_Sale",
        signal_detail: `DLBA For Sale: ${addr} (${a.neighborhood ?? "Detroit"}, ${a.program ?? "DLBA"}) — investors buying DLBA properties need renovation financing. FHA 203(k) and MSHDA programs apply`,
        signal_url: `https://detroitlandbank.org/buy/`,
        signal_date: a.listing_date ? new Date(a.listing_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
      });
    }
  } catch (e) { console.warn("[scanner] DLBA for sale:", e instanceof Error ? e.message : e); }
  return results;
}

// Detroit Assessor recent property sales — new homeowners need mortgage review / equity products
async function scanDetroitPropertySales(): Promise<RawSignal[]> {
  const results: RawSignal[] = [];
  try {
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const where = encodeURIComponent(`sale_date >= '${cutoff}' AND amt_sale_price > 15000`);
    const res = await fetch(
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/assessor_property_sales_view/FeatureServer/0/query?where=${where}&outFields=address,zip_code,sale_date,amt_sale_price,grantee&resultRecordCount=60&orderByFields=sale_date+DESC&f=json`,
      { headers: { "User-Agent": "DWA-MortgageRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const feat of (d?.features ?? [])) {
      const a = feat?.attributes ?? {};
      const addr: string = a.address ?? "";
      if (!addr) continue;
      results.push({
        address: addr,
        city: "Detroit",
        zip: a.zip_code ?? "",
        signal_type: "new_homeowner",
        signal_source: "Detroit_Assessor_Sales",
        signal_detail: `Detroit property sale: ${a.grantee ?? "buyer"} paid $${(a.amt_sale_price || 0).toLocaleString()} — recent buyer in older Detroit home likely needs renovation financing or equity assessment`,
        signal_url: undefined,
        signal_date: a.sale_date ? new Date(a.sale_date).toISOString().slice(0, 10) : new Date().toISOString().split("T")[0],
      });
    }
  } catch (e) { console.warn("[scanner] Detroit assessor sales:", e instanceof Error ? e.message : e); }
  return results;
}

// CourtListener — Michigan Eastern District federal bankruptcy filings (free, no key)
// Chapter 13 = homeowner restructuring debt, often needs a cash-out refi to satisfy trustee.
async function scanBankruptcyFilings(): Promise<RawSignal[]> {
  const results: RawSignal[] = [];
  try {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.courtlistener.com/api/rest/v3/dockets/?court=mied&date_filed__gte=${since}&nature_of_suit=410&format=json&page_size=20`,
      { headers: { "User-Agent": "DWA-MortgageRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const data = await res.json();
    for (const d of (data?.results || [])) {
      const partyName: string = d?.case_name || "";
      if (!partyName) continue;
      results.push({
        address: partyName,
        city: "Detroit",
        zip: "",
        signal_type: "lis_pendens",
        signal_source: "CourtListener_CH13",
        signal_detail: `Chapter 13 bankruptcy filed in MIED: ${partyName} — homeowner restructuring debt often precedes cash-out refi to satisfy trustee`,
        signal_url: `https://www.courtlistener.com${d?.absolute_url || ""}`,
        signal_date: d?.date_filed || new Date().toISOString(),
      });
    }
  } catch (e) { console.warn("[scanner] CourtListener:", e instanceof Error ? e.message : e); }
  return results;
}

// OpenFEMA HMGP — Hazard Mitigation Grant Program projects in MI (flood-elevated homes)
// Areas receiving mitigation grants = neighbors who didn't apply but have the same exposure.
async function scanFEMAHazardMitigation(): Promise<RawSignal[]> {
  const results: RawSignal[] = [];
  try {
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/HazardMitigationGrants?$filter=state eq 'MI'&$top=20&$orderby=projectDate desc`,
      { headers: { "User-Agent": "DWA-MortgageRadar/1.0 (matt@detroitwebagent.com)" }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return results;
    const d = await res.json();
    for (const proj of (d?.HazardMitigationGrants || []).slice(0, 10)) {
      if (!proj.county && !proj.subgrantee) continue;
      results.push({
        address: proj.subgrantee ?? proj.county ?? "Michigan",
        city: proj.county?.split(" County")[0] ?? "Michigan",
        zip: "",
        signal_type: "fema_disaster",
        signal_source: "FEMA_HMGP",
        signal_detail: `FEMA HMGP: ${proj.projectType ?? "hazard mitigation"} grant in ${proj.county ?? "MI"} — areas receiving mitigation funding had documented severe damage; adjacent homeowners are prime mortgage leads`,
        signal_url: `https://www.fema.gov/grants/mitigation`,
        signal_date: proj.projectDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      });
    }
  } catch (e) { console.warn("[scanner] FEMA HMGP:", e instanceof Error ? e.message : e); }
  return results;
}

// 50-source registry: pulls FEMA/NOAA/HUD vacancy/EPA lead lines etc. via signal_waterfall.
// Address-less rows get quarantined by validateLead but update sourceBreakdown for coverage.
async function scanRegistryWaterfall(sb: any): Promise<RawSignal[]> {
  try {
    const sigs = await fetchMortgageSignals(sb, { state: "MI", days: 30 });
    const out: RawSignal[] = [];
    for (const s of (sigs || []).slice(0, 200)) {
      const a = s as any;
      out.push({
        address: a.address,
        city: a.city,
        zip: a.zip,
        signal_type: a.type || "registry_signal",
        signal_source: a.source || "registry",
        signal_detail: a.detail || a.description,
        signal_url: a.url,
        signal_date: a.date || new Date().toISOString(),
      });
    }
    return out;
  } catch (e) {
    console.warn("[scanner] registry waterfall failed:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();

  const results = await Promise.allSettled([
    scanBSEEDPermits(),
    scanForeclosureNotices(),
    scanFSBOListings(),
    scanDivorceFilings(),
    scanNewMichiganLLCs(sb),
    scanHighEquityLowRate(),
    scanJobChanges(),
    scanProbateFilings(),
    scanEstateSalesExpanded(),        // #7 expanded city coverage
    scanTaxDelinquency(),
    scanFixerUpperListings(),
    scanSBAApprovals(),
    scanLARANewLLCs(),                // #5 LARA SOS direct scrape
    scanWayneCountyDeeds(),           // #1 Wayne County Register of Deeds
    scanOaklandCountyPermits(),       // #2 Oakland County permit portal
    scanPriceReductions(),            // #3 Realtor.com price-reduced listings
    scanBankruptcyFilings(),          // CourtListener MIED Chapter 13 filings
    scanFEMAHazardMitigation(),       // FEMA HMGP grant areas = adjacent homeowner leads
    scanPresaleInspections(),         // BSEED pre-sale inspections = imminent transactions
    scanDLBAForSale(),                // DLBA for sale = investor renovation loans
    scanDetroitPropertySales(),       // Detroit assessor recent sales = new homeowners
    scanRegistryWaterfall(sb),        // 50-source registry: FEMA/NOAA/HUD vacancy/EPA lead lines etc.
  ]);

  const signals: RawSignal[] = [];
  const sourceBreakdown: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const s of r.value) {
        signals.push(s);
        sourceBreakdown[s.signal_source] = (sourceBreakdown[s.signal_source] || 0) + 1;
      }
    } else {
      console.warn("[scanner] source rejected:", r.reason);
    }
  }

  let inserted = 0;
  let updated = 0;
  let quarantined = 0;
  let alertsQueued = 0;
  let inlineEnriched = 0;
  let queuedForEnrich = 0;
  let hotSmsFired = 0;
  let inlineEnrichBudget = 5; // first 5 new leads per run get inline enrich; rest go to queue
  const acceptedBySource: Record<string, number> = {};
  const quarantinedBySource: Record<string, number> = {};

  for (const s of signals) {
    // ===== ANTI-HALLUCINATION GATE =====
    // Validates address (Google Address Validation), checks placeholder fingerprints,
    // checks cross-run quarantine history, and demands a real source URL for LLM-sourced leads.
    const gate = await validateLead(sb, s, { sourceMethod: s.source_method || "scraper" });
    if (!gate.pass) {
      await quarantineRaw(sb, s, gate.reject_code || "unknown", gate.reject_reason || "validation failed", s.source_method || "unknown");
      quarantined += 1;
      quarantinedBySource[s.signal_source] = (quarantinedBySource[s.signal_source] || 0) + 1;
      continue;
    }
    // Stamp validated lat/lon and formatted address onto the signal so upsertWithDedup persists them.
    s.lat = gate.lat;
    s.lon = gate.lon;
    s.formatted_address = gate.formatted;

    const res = await upsertWithDedup(sb, s);
    if (!res) continue;
    if (res.created) inserted += 1; else updated += 1;
    acceptedBySource[s.signal_source] = (acceptedBySource[s.signal_source] || 0) + 1;

    // Mark originating row as processed after successful upsert
    if (s.source_id) {
      await (sb.from as any)("industry_pulse_signals")
        .update({ pitched_mortgage_radar_at: new Date().toISOString() })
        .eq("id", s.source_id);
    }

    // Enrichment: inline first 5 new leads, queue the rest
    if (res.created) {
      if (inlineEnrichBudget > 0) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/mortgage-radar-enrich`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: res.id }),
          });
          if (r.ok) { inlineEnriched += 1; inlineEnrichBudget -= 1; }
        } catch (_) { /* fall through to queue */ }
      } else {
        await (sb.from as any)("mortgage_radar_enrich_queue")
          .upsert({ lead_id: res.id, status: "pending" }, { onConflict: "lead_id" });
        queuedForEnrich += 1;
      }
    }

    // Phase B: respect the trust cap. Unverified LLM-only leads cannot trigger hot SMS.
    const rawScore = scoreFor(s.signal_type);
    const score = s.source_method === "llm_search" ? Math.min(3, rawScore) : rawScore;
    const matchedClientIds = await notifyClients(sb, s.zip, s.county, score);
    if (matchedClientIds.length > 0) {
      await (sb.from as any)("mortgage_radar_leads")
        .update({ notified_client_ids: matchedClientIds })
        .eq("id", res.id);
      alertsQueued += matchedClientIds.length;

      // Trial gating: decrement trial_leads_remaining; skip delivery when exhausted
      if (matchedClientIds.length > 0) {
        const { data: trialClients } = await (sb.from as any)("mortgage_radar_clients")
          .select("id, trial_active, trial_leads_remaining, email, contact_name")
          .in("id", matchedClientIds)
          .eq("trial_active", true);
        for (const tc of (trialClients || [])) {
          const remaining = tc.trial_leads_remaining ?? 0;
          if (remaining <= 0) {
            // Trial exhausted — remove from matchedClientIds so no SMS fires
            const idx = matchedClientIds.indexOf(tc.id);
            if (idx > -1) matchedClientIds.splice(idx, 1);
            // Notify Matt once (idempotent — scanner runs daily, check if already notified)
            await (sb.from as any)("mortgage_radar_clients")
              .update({ trial_active: false })
              .eq("id", tc.id)
              .eq("trial_active", true);
            const adminPhone = Deno.env.get("ADMIN_PHONE") || "";
            if (adminPhone) {
              await sendSMS(adminPhone, DWA_PHONE, `⏰ Mortgage Radar trial exhausted: ${tc.contact_name || tc.email} — 10 free leads done. Card on file. Upgrade to $399/mo.`, "mortgage_radar_trial_expired").catch(() => {});
            }
          } else {
            await (sb.from as any)("mortgage_radar_clients")
              .update({ trial_leads_remaining: remaining - 1 })
              .eq("id", tc.id);
          }
        }
      }

      // Hot lead SMS (score >= 9) to matched clients with phone on file
      if (score >= 9 && res.created) {
        const { data: hotClients } = await (sb.from as any)("mortgage_radar_clients")
          .select("phone, business_name, trial_active, trial_leads_remaining")
          .in("id", matchedClientIds);
        for (const c of (hotClients || [])) {
          if (c.phone) {
            const sigLabel = s.signal_type.replace(/_/g, " ");
            const dashLink = `https://detroitwebagent.com/my-mortgage-radar?lead=${res.id}`;
            const streetView = s.address ? `https://maps.google.com/?q=${encodeURIComponent(s.address)}` : "";
            const hotMsg = `🔥 HOT MORTGAGE LEAD (${score}/10)\n${s.address || ""}\nSignal: ${sigLabel}\n\n📍 ${streetView}\n📊 Intel + outreach: ${dashLink}\n\nManual send only — TCPA. Reply STOP to opt out. — DWA`;
            await sendSMS(c.phone, DWA_PHONE, hotMsg, "mortgage_radar_hot_lead");
            hotSmsFired += 1;
          }
        }
      }
    }
  }

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `🏠 Mortgage Radar — ${inserted} new, ${updated} updated, ${alertsQueued} alerts, ${hotSmsFired} hot SMS`,
          html: `<p><strong>Mortgage Radar daily run</strong></p>
            <p>Started: ${startedAt}<br>Signals fetched: ${signals.length}<br>New leads: ${inserted}<br>Updated (repeat signals): ${updated}<br>Client alerts queued: ${alertsQueued}<br>Inline-enriched: ${inlineEnriched}<br>Queued for enrich: ${queuedForEnrich}<br>Hot lead SMS fired: ${hotSmsFired}</p>
            <pre>${JSON.stringify(sourceBreakdown, null, 2)}</pre>`,
        }),
      });
    } catch (e) {
      console.warn("[mortgage-radar-scanner] digest send failed:", e instanceof Error ? e.message : String(e));
    }
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "mortgage-radar-scanner",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { signals_fetched: signals.length, inserted, updated, hot_sms_fired: hotSmsFired },
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({
    ok: true,
    started_at: startedAt,
    signals_fetched: signals.length,
    inserted,
    updated,
    alerts_queued: alertsQueued,
    inline_enriched: inlineEnriched,
    queued_for_enrich: queuedForEnrich,
    hot_sms_fired: hotSmsFired,
    source_breakdown: sourceBreakdown,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
