// Production Batch 1 — 5 zero-auth Tier-S/A sources wired against the ingestion framework.
// See knowledge/scanner-source-backlog-next-20.md for full backlog.
//
// All sources here require NO API key. Each is rate-limited per host, retries on 429,
// auto-normalizes into canonical_events/canonical_signals, and logs to scanner_source_runs.

import { defineSource } from "./source-framework.ts";

// ─── Tier-S #6: NWS Active Alerts (Michigan) ────────────────────────────────
// Polygon-level weather warnings. Feeds trade_radar (storm/hail/wind → roofing/exterior/gutters).
export const nwsActiveAlertsMI = defineSource({
  slug: "nws_active_alerts_mi",
  product: "trade_radar",
  host: "api.weather.gov",
  rps: 2,
  fetch: async (ctx) =>
    await ctx.fetchJson<{ features: unknown[] }>(
      "https://api.weather.gov/alerts/active?area=MI",
      { headers: { "User-Agent": "DWA Scanner (matt@detroitwebagent.com)" } },
    ),
  extractRows: (payload) => (payload?.features ?? []) as Record<string, unknown>[],
  normalize: (feature) => {
    const p = (feature as { properties?: Record<string, unknown> }).properties ?? {};
    return {
      external_id: p.id ?? p.identifier,
      title: p.event,
      description: p.headline,
      occurred_at: p.sent ?? p.effective,
      address: p.areaDesc,
      url: (feature as { id?: string }).id,
    };
  },
});

// ─── Tier-S #18: EPA ECHO enforcement cases (MI, last 90 days) ─────────────
// Feeds industry_pulse + counsel_records (environmental violations = legal/PR signal).
export const epaEchoEnforcementMI = defineSource({
  slug: "epa_echo_enforcement_mi",
  product: "industry_pulse",
  host: "echodata.epa.gov",
  rps: 1,
  fetch: async (ctx) =>
    await ctx.fetchJson(
      "https://echodata.epa.gov/echo/case_rest_services.get_cases?output=JSON&p_st=MI&p_act_lim=90",
    ),
  extractRows: (payload) =>
    ((payload as { Results?: { Cases?: unknown[] } })?.Results?.Cases ?? []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, unknown>;
    return {
      external_id: r.CaseNumber ?? r.case_number,
      company_name: r.DefendantEntity ?? r.defendant_entity,
      title: r.CaseName ?? r.case_name,
      description: r.PrimaryLaw ?? r.primary_law,
      occurred_at: r.SettlementDate ?? r.FiledDate,
      address: r.FacilityAddress,
      city: r.FacilityCity,
      state: r.FacilityState,
      zip: r.FacilityZip,
    };
  },
});

// ─── Tier-S #7: FCC ULS recent license grants (amateur/business radio) ─────
// Public CSV/JSON proxy. Feeds techalert + channel_prospector (new business radio = expansion signal).
export const fccUlsRecentGrants = defineSource({
  slug: "fcc_uls_recent_grants",
  product: "techalert",
  host: "data.fcc.gov",
  rps: 1,
  fetch: async (ctx) =>
    await ctx.fetchJson(
      "https://data.fcc.gov/api/license-view/basicSearch/getLicenses?searchValue=*&state=MI&pageSize=50&format=json",
    ),
  extractRows: (payload) =>
    ((payload as { Licenses?: { License?: unknown[] } })?.Licenses?.License ?? []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, unknown>;
    return {
      external_id: r.licenseID ?? r.callsign,
      company_name: r.licName,
      title: `FCC License Grant — ${r.serviceDesc ?? "Radio"}`,
      occurred_at: r.grantDate,
      city: r.licCity,
      state: r.licState,
      zip: r.licZip,
    };
  },
});

// ─── Tier-A #17: Detroit Police incident reports (last 7 days) ─────────────
// City of Detroit Open Data Socrata. Feeds trade_radar (vandalism/break-ins → restoration/security).
export const detroitDpdIncidents = defineSource({
  slug: "detroit_dpd_incidents",
  product: "trade_radar",
  host: "data.detroitmi.gov",
  rps: 2,
  fetch: async (ctx) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const url = `https://data.detroitmi.gov/resource/dpsa-d7zb.json?$where=incident_timestamp >= '${since}'&$limit=500`;
    return await ctx.fetchJson(url);
  },
  extractRows: (payload) => (Array.isArray(payload) ? payload : []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, unknown>;
    return {
      external_id: r.crime_id ?? r.incident_id,
      title: r.offense_description ?? r.category,
      description: r.offense_category,
      occurred_at: r.incident_timestamp,
      address: r.address,
      city: "Detroit",
      state: "MI",
      zip: r.zip_code,
      lat: r.latitude,
      lon: r.longitude,
    };
  },
});

// ─── Tier-A #20: Michigan SOS — recent business entity filings ─────────────
// LARA public bulk export. Feeds channel_prospector + dead_lead_pool (new biz = sales target).
export const michiganSosNewEntities = defineSource({
  slug: "michigan_sos_new_entities",
  product: "channel_prospector",
  host: "cofs.lara.state.mi.us",
  rps: 1,
  fetch: async (ctx) => {
    // LARA exposes recent filings via their COFS public search JSON endpoint.
    return await ctx.fetchJson(
      "https://cofs.lara.state.mi.us/CorpWeb/CorpSearch/CorpSearchResults.aspx?api=1&filter=recent&days=7",
    );
  },
  extractRows: (payload) =>
    ((payload as { entities?: unknown[] })?.entities ?? []) as Record<string, unknown>[],
  normalize: (row) => {
    const r = row as Record<string, unknown>;
    return {
      external_id: r.id_number ?? r.entity_id,
      company_name: r.entity_name,
      title: `New MI entity — ${r.entity_type ?? "LLC/Corp"}`,
      occurred_at: r.formation_date ?? r.filed_date,
      address: r.registered_address,
      city: r.registered_city,
      state: "MI",
      zip: r.registered_zip,
    };
  },
});

export const BATCH_1_SOURCES = [
  nwsActiveAlertsMI,
  epaEchoEnforcementMI,
  fccUlsRecentGrants,
  detroitDpdIncidents,
  michiganSosNewEntities,
];
