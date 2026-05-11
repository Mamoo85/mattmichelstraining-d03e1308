// Wave 1 Batch 1E — County deed / foreclosure signals for Trade Radar.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { withSourceHealth } from "./source-health.ts";
//
// Sources:
//   #6  Kent County (Grand Rapids) deeds       — ArcGIS, new-owner + pre-1990
//   #24 Cuyahoga fiscal officer sales (Cleveland) — ArcGIS, recent sales
//   #41 Wayne County tax foreclosure auction   — public web scrape via Firecrawl
//
// All emit per-address signals (NOT in AREA_ALERT_TYPES) that flow through
// validateLead → trade_radar_leads. All scrapers are fail-graceful — if a
// county changes its endpoint, that one source returns [] and the scan
// continues.

type Vertical =
  | "roofing" | "hvac" | "plumbing" | "electrical" | "pest_control"
  | "gutters" | "exterior" | "tree" | "restoration" | "demo_junk" | "foundation";

export type DeedSignal = {
  address: string;
  city?: string;
  zip?: string;
  state?: string;
  signal_type: string;
  signal_detail?: string;
  signal_date?: string;
  signal_url?: string;
  score?: number;
  source_method: "scraper";
  suggested_opener?: string;
  estimated_value?: number;
  raw_source_data?: Record<string, unknown>;
};

const ALL_VERTICALS: Vertical[] = [
  "roofing","hvac","plumbing","electrical","pest_control",
  "gutters","exterior","tree","restoration","demo_junk","foundation",
];

const OPENER_BY_VERTICAL: Record<Vertical, string> = {
  roofing: "Welcome to the home — quick complimentary roof check?",
  hvac: "New homeowner package — free HVAC tune-up?",
  plumbing: "Free plumbing inspection for new homeowners.",
  electrical: "Free electrical/panel safety check for new homeowners.",
  pest_control: "New-owner pest baseline — free inspection.",
  gutters: "New-owner gutter & downspout check, complimentary.",
  exterior: "Welcome — exterior walk-around inspection?",
  tree: "Free tree-hazard walk for the new lot.",
  restoration: "Owner just bought — any water/storm damage we should look at?",
  demo_junk: "New owner — need debris/junk haul from the prior owner?",
  foundation: "Free foundation/basement walk for the new owners.",
};

const ESTIMATED_VALUE: Record<Vertical, number> = {
  roofing: 12_000, hvac: 8_000, plumbing: 5_000, electrical: 6_000,
  pest_control: 600, gutters: 2_500, exterior: 8_000, tree: 1_500,
  restoration: 6_000, demo_junk: 1_500, foundation: 4_500,
};

// ---------------------------------------------------------------------------
// #6 — Kent County (Grand Rapids) deeds via ArcGIS
// ---------------------------------------------------------------------------
async function fetchKentDeeds(vertical: Vertical): Promise<DeedSignal[]> {
  // Best-known parcel-sales feature service. If layer schema changes, this
  // fails open with [].
  const url =
    "https://services1.arcgis.com/Ka27DAYJExZkVglg/arcgis/rest/services/Parcels_Public/FeatureServer/0/query" +
    "?where=" + encodeURIComponent("SALE_DATE >= CURRENT_DATE - 90") +
    "&outFields=PROP_ADR,CITY,ZIP,SALE_DATE,YEAR_BUILT,OWNER_NAME" +
    "&f=json&resultRecordCount=200&orderByFields=SALE_DATE+DESC";
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const feats = (j?.features ?? []) as any[];
    const out: DeedSignal[] = [];
    for (const f of feats) {
      const a = f?.attributes ?? {};
      const yr = Number(a.YEAR_BUILT);
      if (!a.PROP_ADR || !yr || yr >= 1990) continue;
      out.push({
        address: String(a.PROP_ADR),
        city: a.CITY ? String(a.CITY) : "Grand Rapids",
        zip: a.ZIP ? String(a.ZIP) : undefined,
        state: "MI",
        signal_type: "new_owner_old_home",
        signal_detail: `New owner of ${yr}-built home (Kent Co)`,
        signal_date: a.SALE_DATE
          ? new Date(a.SALE_DATE).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        score: 7,
        source_method: "scraper",
        suggested_opener: OPENER_BY_VERTICAL[vertical],
        estimated_value: ESTIMATED_VALUE[vertical],
        raw_source_data: { source: "kent_county_deeds", year_built: yr, owner: a.OWNER_NAME },
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// #24 — Cuyahoga (Cleveland) fiscal officer sales via ArcGIS
// ---------------------------------------------------------------------------
async function fetchCuyahogaSales(vertical: Vertical): Promise<DeedSignal[]> {
  const url =
    "https://services.arcgis.com/lLFRT0RpcoCmEa1c/arcgis/rest/services/Parcels/FeatureServer/0/query" +
    "?where=" + encodeURIComponent("Sale_Date >= CURRENT_DATE - 90 AND Year_Built < 1990") +
    "&outFields=Property_Address,City,Zip,Sale_Date,Year_Built,Owner_Name" +
    "&f=json&resultRecordCount=200&orderByFields=Sale_Date+DESC";
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const feats = (j?.features ?? []) as any[];
    const out: DeedSignal[] = [];
    for (const f of feats) {
      const a = f?.attributes ?? {};
      if (!a.Property_Address) continue;
      out.push({
        address: String(a.Property_Address),
        city: a.City ? String(a.City) : "Cleveland",
        zip: a.Zip ? String(a.Zip) : undefined,
        state: "OH",
        signal_type: "new_owner_old_home",
        signal_detail: `New owner of ${a.Year_Built}-built home (Cuyahoga Co)`,
        signal_date: a.Sale_Date
          ? new Date(a.Sale_Date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        score: 7,
        source_method: "scraper",
        suggested_opener: OPENER_BY_VERTICAL[vertical],
        estimated_value: ESTIMATED_VALUE[vertical],
        raw_source_data: { source: "cuyahoga_fiscal_officer", year_built: a.Year_Built, owner: a.Owner_Name },
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// #41 — Wayne County tax foreclosure auction — Firecrawl scrape (RS + DJ)
// ---------------------------------------------------------------------------
async function fetchWayneTaxForeclosure(vertical: Vertical): Promise<DeedSignal[]> {
  if (vertical !== "restoration" && vertical !== "demo_junk") return [];
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.waynecounty.com/elected/treasurer/foreclosure-auctions.aspx",
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const md: string = j?.data?.markdown || j?.markdown || "";
    // Crude address line extraction: lines containing a number-prefix + street word
    const lines = md.split("\n")
      .map((s) => s.trim())
      .filter((s) =>
        /^\d{2,6}\s+[A-Z][A-Za-z]/.test(s) &&
        /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|ct|court|pl)\b/i.test(s)
      )
      .slice(0, 50);
    return lines.map((addr) => ({
      address: addr,
      city: "Detroit",
      state: "MI",
      signal_type: "foreclosure_vacant",
      signal_detail: "Wayne County tax foreclosure auction listing",
      signal_date: new Date().toISOString().slice(0, 10),
      signal_url: "https://www.waynecounty.com/elected/treasurer/foreclosure-auctions.aspx",
      score: 8,
      source_method: "scraper" as const,
      suggested_opener: OPENER_BY_VERTICAL[vertical],
      estimated_value: ESTIMATED_VALUE[vertical],
      raw_source_data: { source: "wayne_tax_foreclosure" },
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Aggregator — gated by coverage_regions
// ---------------------------------------------------------------------------
export async function runCountyDeedSignals(
  vertical: Vertical,
  coverageRegions: string[],
): Promise<DeedSignal[]> {
  if (!ALL_VERTICALS.includes(vertical)) return [];
  const joined = (coverageRegions ?? []).join(" ").toLowerCase();

  const tasks: Array<Promise<DeedSignal[]>> = [];
  if (/grand\s*rapids|kent/.test(joined)) tasks.push(fetchKentDeeds(vertical));
  if (/cleveland|cuyahoga/.test(joined)) tasks.push(fetchCuyahogaSales(vertical));
  if (/detroit|wayne/.test(joined)) tasks.push(fetchWayneTaxForeclosure(vertical));

  if (tasks.length === 0) return [];
  const results = await Promise.allSettled(tasks);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
