// Phase A dispatcher — runs new sources for a given product and logs results
// to scanner_extras_runs. Fail-graceful: any source error is captured per-source.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as ex from "./scanner-extras-2026.ts";
import * as exb from "./scanner-extras-2026-b.ts";

type Job = { source: string; run: () => Promise<unknown> };

const PRODUCT_JOBS: Record<string, () => Job[]> = {
  trade_radar: () => [
    { source: "usda_drought_counties", run: () => ex.fetchDroughtMonitorCounties("MI") },
    { source: "usgs_water_alerts", run: () => ex.fetchUSGSWaterAlerts("MI") },
    { source: "nws_severe_thunderstorm_watches", run: () => ex.fetchNWSSevereThunderWatches("MI") },
    { source: "detroit_new_business_licenses", run: () => ex.fetchDetroitNewBusinessLicenses() },
    // Phase B
    { source: "noaa_storm_events_recent", run: () => exb.fetchNOAAStormEventsRecent("MICHIGAN") },
    { source: "epa_air_quality", run: () => exb.fetchEPAAirQuality("26") },
    { source: "nws_heat_advisories", run: () => exb.fetchNWSHeatAdvisories("MI") },
    { source: "detroit_311_water", run: () => exb.fetchDetroit311Trade("water") },
  ],
  mortgage_radar: () => [
    { source: "hud_usps_vacancy", run: () => ex.fetchHUDVacancyByZip([]) },
    { source: "census_building_permits", run: () => ex.fetchCensusBuildingPermits("26") },
    { source: "bls_unemployment", run: () => ex.fetchBLSUnemployment() },
    { source: "realtor_price_cuts_48201", run: () => ex.fetchRealtorPriceCuts("48201") },
    // Phase B
    { source: "fred_30yr_rate", run: () => exb.fetchFRED30YR() },
    { source: "fhfa_hpi_detroit", run: () => exb.fetchFHFAHPI() },
    { source: "cfpb_complaints_mi", run: () => exb.fetchCFPBComplaints("MI") },
    { source: "wayne_sheriff_sales", run: () => exb.fetchWayneSheriffSales() },
  ],
  techalert: () => [
    { source: "usajobs_trades", run: () => ex.fetchUSAJobsTrades() },
    { source: "bls_qcew", run: () => ex.fetchBLSQCEW() },
    { source: "propublica_nonprofits", run: () => ex.fetchProPublicaNonprofits("MI") },
    { source: "sam_entity_expansions", run: () => ex.fetchSAMEntityExpansions() },
    // Phase B
    { source: "dol_h1b_mi", run: () => exb.fetchDOLH1B("MI") },
    { source: "michigan_warn", run: () => exb.fetchMichiganWARN() },
    { source: "nlrb_petitions_mi", run: () => exb.fetchNLRBPetitions("MI") },
    { source: "osha_accidents_hvac", run: () => exb.fetchOSHAAccidents("238220") },
  ],
  demand_radar: () => [
    { source: "bidnet_rss", run: () => ex.fetchBidNetRSS("MI") },
    { source: "michigan_bids_arcgis", run: () => ex.fetchMichiganBidsArcGIS() },
    { source: "usaspending_naics", run: () => ex.fetchUSAspendingNAICS() },
    { source: "demandstar_summary", run: () => ex.fetchDemandStarSummary() },
    // Phase B
    { source: "sam_contract_opps", run: () => exb.fetchSAMContractOpps() },
    { source: "wayne_county_purchasing", run: () => exb.fetchWayneCountyPurchasing() },
    { source: "mdot_bid_letting", run: () => exb.fetchMDOTBidLetting() },
    { source: "grants_gov", run: () => exb.fetchGrantsGov() },
  ],
  industry_pulse: () => [
    { source: "bls_employment_situation", run: () => ex.fetchBLSEmploymentSituation() },
    { source: "census_bfs", run: () => ex.fetchCensusBFS() },
    { source: "fred_indicators", run: () => ex.fetchFREDIndicators() },
    { source: "linkedin_company_growth", run: () => ex.fetchLinkedInCompanyGrowth([]) },
    // Phase B
    { source: "census_qss", run: () => exb.fetchCensusQSS() },
    { source: "nahb_hmi", run: () => exb.fetchNAHBHMI() },
    { source: "nfib_optimism", run: () => exb.fetchNFIBOptimism() },
    { source: "aia_abi", run: () => exb.fetchAIAABI() },
  ],
  dead_lead_pool: () => [
    { source: "detroit_contractors_expiring", run: () => ex.fetchDetroitContractorsExpiringSoon() },
    { source: "lara_builders", run: () => ex.fetchLARABuilders("48201") },
    { source: "bbb_accredited_mi_hvac", run: () => ex.fetchBBBAccreditedMI("hvac") },
    { source: "google_places_closed_detroit_hvac", run: () => ex.fetchGooglePlacesClosed("HVAC contractor Detroit") },
    // Phase B
    { source: "mi_sos_dissolved", run: () => exb.fetchMISOSDissolved() },
    { source: "irs_exempt_revocations_mi", run: () => exb.fetchIRSExemptRevocations("MI") },
    { source: "yelp_closed_hvac_detroit", run: () => exb.fetchYelpClosed("hvac", "Detroit") },
    { source: "manta_defunct_hvac", run: () => exb.fetchMantaDefunct("238220") },
  ],
  counsel_records: () => [
    { source: "lara_disciplinary", run: () => ex.fetchLARADisciplinaryRSS() },
    { source: "adb_orders", run: () => ex.fetchADBOrders() },
    { source: "tax_court_opinions", run: () => ex.fetchTaxCourtOpinions() },
    { source: "fec_contributions_demo", run: () => ex.fetchFECContributions("Smith") },
    // Phase B
    { source: "courtlistener_miwd_opinions", run: () => exb.fetchCourtListenerOpinions("miwd") },
    { source: "mi_coa_opinions", run: () => exb.fetchMICourtOfAppeals() },
    { source: "sixth_circuit_opinions", run: () => exb.fetchSixthCircuitOpinions() },
    { source: "sec_litigation_releases", run: () => exb.fetchSECLitigationReleases() },
  ],
  channel_prospector: () => [
    { source: "osm_overpass_trades_hvac", run: () => ex.fetchOSMOverpassTrades("hvac") },
    { source: "wikidata_michigan_companies", run: () => ex.fetchWikidataMichiganCompanies("construction") },
    { source: "misos_entities_hvac", run: () => ex.fetchMISOSEntities("HVAC") },
    { source: "detroit_open_business_238", run: () => ex.fetchDetroitOpenBusinessRegistry("238") },
    // Phase B
    { source: "yelp_biz_hvac_detroit", run: () => exb.fetchYelpBiz("hvac", "Detroit") },
    { source: "foursquare_places_hvac", run: () => exb.fetchFoursquarePlaces("hvac", "Detroit,MI") },
    { source: "nominatim_hvac_detroit", run: () => exb.fetchNominatimSearch("hvac contractor Detroit") },
    { source: "opencage_detroit", run: () => exb.fetchOpenCageGeocode("Detroit MI") },
  ],
  email_waterfall: () => [
    { source: "dns_txt_spf_dwa", run: () => ex.fetchDNSTextSPF("detroitwebagent.com") },
    { source: "whois_email_dwa", run: () => ex.fetchWhoisEmail("detroitwebagent.com") },
    { source: "schema_org_email_dwa", run: () => ex.fetchSchemaOrgEmail("detroitwebagent.com") },
    { source: "sitemap_contact_dwa", run: () => ex.fetchSitemapContactPages("detroitwebagent.com") },
    // Phase B
    { source: "ct_logs_subdomains_dwa", run: () => exb.fetchCTLogsSubdomains("detroitwebagent.com") },
    { source: "github_commit_emails_demo", run: () => exb.fetchGitHubCommitEmails("supabase") },
    { source: "wayback_contact_dwa", run: () => exb.fetchWaybackContact("detroitwebagent.com") },
    { source: "orcid_search_demo", run: () => exb.fetchORCIDEmail("Smith") },
  ],
  siteradar_visitor: () => [
    { source: "ipapi_co", run: () => ex.fetchIPAPIco("8.8.8.8") },
    { source: "abuseipdb", run: () => ex.fetchAbuseIPDB("8.8.8.8") },
    { source: "reverse_dns", run: () => ex.fetchReverseDNS("8.8.8.8") },
    { source: "bgp_tools_asn", run: () => ex.fetchBGPToolsASN("15169") },
    // Phase B
    { source: "ripestat_asn", run: () => exb.fetchRIPEstatASN("8.8.8.8") },
    { source: "peeringdb_org", run: () => exb.fetchPeeringDBOrg("15169") },
    { source: "team_cymru_ipinfo", run: () => exb.fetchTeamCymruIPInfo("8.8.8.8") },
    { source: "crt_sh_certs", run: () => exb.fetchCrtShCerts("detroitwebagent.com") },
  ],
};

export async function runPhaseAExtras(product: string): Promise<{
  product: string;
  results: Array<{ source: string; count: number; ms: number; error?: string }>;
}> {
  const jobs = PRODUCT_JOBS[product]?.() || [];
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results: Array<{ source: string; count: number; ms: number; error?: string }> = [];
  for (const j of jobs) {
    const t0 = Date.now();
    let count = 0;
    let error: string | undefined;
    let sample: unknown = null;
    try {
      const out = await j.run();
      if (Array.isArray(out)) {
        count = out.length;
        sample = out.slice(0, 2);
      } else if (out && typeof out === "object") {
        count = 1;
        sample = out;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const ms = Date.now() - t0;
    results.push({ source: j.source, count, ms, error });

    // Fire-and-forget audit insert
    sb.from("scanner_extras_runs")
      .insert({ product, source: j.source, count, ms, error, sample: sample as any })
      .then(() => {})
      .catch(() => {});
  }
  return { product, results };
}

export const SUPPORTED_PRODUCTS = Object.keys(PRODUCT_JOBS);
