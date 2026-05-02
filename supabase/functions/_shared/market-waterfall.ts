// Market waterfall — state + metro → FRED + BLS QCEW + Census + HUD FMR.
// Cached 30 days. Used by "why this market" auto-content (out-of-state credibility).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { useSourcesParallel, type SourceCall } from "./sources/use.ts";

export interface MarketContext {
  state: string;
  state_fips?: string;     // e.g. "26" for MI
  naics?: string;          // e.g. "238220" HVAC
  fred_series?: string;    // e.g. "MIBP1FH" — Michigan building permits
  oews_series?: string;    // BLS OEWS occupational employment series id
}

export interface MarketSnapshot {
  state: string;
  hud_fmr_counties: number;
  hmda_loans: number;
  qcew_employment_estabs: number;
  cbp_business_count: number;
  oews_wage: any;
  fred_indicator: any;
  census_acs_housing: any;
  generated_at: string;
  raw: Record<string, unknown>;
}

export async function fetchMarketSnapshot(
  sb: SupabaseClient,
  ctx: MarketContext,
): Promise<MarketSnapshot> {
  const fips = ctx.state_fips ?? "26";
  const calls: SourceCall[] = [
    { id: "hud_fmr", params: { state: ctx.state } },
    { id: "ffiec_hmda", params: { state: ctx.state } },
    { id: "bls_qcew", params: { state: fips, industry: ctx.naics ?? "1012" } },
    { id: "census_business_patterns", params: { state: fips, naics: ctx.naics ?? "238220" } },
    { id: "bls_oews", params: { series_id: ctx.oews_series ?? "OEUM0198980000000000001" } },
    { id: "fred_indicators", params: { series_id: ctx.fred_series ?? "MIBP1FH" } },
    { id: "census_acs_housing", params: { state: fips } },
  ];
  const out = await useSourcesParallel<any>(sb, calls);

  return {
    state: ctx.state,
    hud_fmr_counties: (out.hud_fmr?.data ?? []).length,
    hmda_loans: (out.ffiec_hmda?.data ?? []).length,
    qcew_employment_estabs: (out.bls_qcew?.data ?? []).length,
    cbp_business_count: (out.census_business_patterns?.data ?? []).length,
    oews_wage: (out.bls_oews?.data ?? [])[0] ?? null,
    fred_indicator: (out.fred_indicators?.data ?? [])[0] ?? null,
    census_acs_housing: (out.census_acs_housing?.data ?? [])[0] ?? null,
    generated_at: new Date().toISOString(),
    raw: out as unknown as Record<string, unknown>,
  };
}
