// Signal waterfall — geo + vertical → returns merged Signal[] from every relevant
// source in the registry tagged for mortgage/techalert/contractor/marketplace.
//
// Used by: mortgage-radar-scanner, techalert-prospect-hunter, outreach-target-discover.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { useSourcesParallel, type SourceCall } from "./sources/use.ts";

export type SignalKind =
  | "vacancy_spike" | "disaster" | "storm" | "renovation_permit"
  | "lead_line_replacement" | "rrp_certified" | "hmda_origination"
  | "warn_layoff" | "osha_inspection" | "osha_sir" | "fed_contract_award"
  | "trucking_growth" | "dot_prequalified" | "fresh_llc" | "github_org"
  | "edgar_funding" | "uspto_patent";

export interface Signal {
  kind: SignalKind;
  source_id: string;
  state?: string;
  city?: string;
  zip?: string;
  county?: string;
  business_name?: string;
  evidence_url?: string;
  observed_at?: string;
  raw: Record<string, unknown>;
}

export interface SignalContext {
  state: string;
  vertical?: string;        // free-form for now
  naics?: string;           // when known, narrows OSHA / SAM / BLS
  zip?: string;
}

// Translate registry rows → Signal[] without any LLM. Pure mapping.
function mapHudVacancy(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).slice(0, 200).map((r) => ({
    kind: "vacancy_spike", source_id: "hud_uspsvacancy",
    state: ctx.state, zip: r?.zip ?? r?.GEO_ID, raw: r,
  }));
}
function mapFema(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "disaster", source_id: "fema_disasters",
    state: r?.state ?? ctx.state, observed_at: r?.declarationDate ?? r?.incidentBeginDate, raw: r,
  }));
}
function mapNoaa(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "storm", source_id: "noaa_storm_events",
    state: ctx.state, observed_at: r?.BEGIN_DATE_TIME ?? r?.begin_date, raw: r,
  }));
}
function mapHmda(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).slice(0, 200).map((r) => ({
    kind: "hmda_origination", source_id: "ffiec_hmda",
    state: ctx.state, raw: r,
  }));
}
function mapEpaLead(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "lead_line_replacement", source_id: "epa_lead_lines",
    state: ctx.state, raw: r,
  }));
}
function mapEpaRrp(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "rrp_certified", source_id: "epa_rrp",
    state: ctx.state, business_name: r?.firm_name ?? r?.name, raw: r,
  }));
}
function mapDolWarn(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "warn_layoff", source_id: "dol_warn",
    state: ctx.state, business_name: r?.company ?? r?.employer, observed_at: r?.notice_date, raw: r,
  }));
}
function mapOshaInsp(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "osha_inspection", source_id: "osha_establishment",
    state: ctx.state, business_name: r?.estab_name ?? r?.company, raw: r,
  }));
}
function mapOshaSir(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "osha_sir", source_id: "osha_sir",
    state: ctx.state, business_name: r?.employer ?? r?.estab_name, observed_at: r?.eventdate, raw: r,
  }));
}
function mapSam(rows: any[], _ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "fed_contract_award", source_id: "sam_gov_opps_expanded",
    business_name: r?.awardee ?? r?.organization, observed_at: r?.postedDate, raw: r,
  }));
}
function mapFmcsa(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "trucking_growth", source_id: "fmcsa_mcs150",
    state: ctx.state, business_name: r?.legal_name ?? r?.name, raw: r,
  }));
}
function mapDotPrequal(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "dot_prequalified", source_id: "state_dot_prequalified",
    state: ctx.state, business_name: r?.contractor ?? r?.name, raw: r,
  }));
}
function mapStateCorpRss(rows: any[], ctx: SignalContext): Signal[] {
  return (rows ?? []).map((r) => ({
    kind: "fresh_llc", source_id: "state_corp_filings_rss",
    state: ctx.state, business_name: r?.title ?? r?.name, observed_at: r?.pubDate, raw: r,
  }));
}

// Mortgage scanner subset.
export async function fetchMortgageSignals(sb: SupabaseClient, ctx: SignalContext): Promise<Signal[]> {
  const calls: SourceCall[] = [
    { id: "hud_uspsvacancy", params: { state: ctx.state } },
    { id: "fema_disasters", params: { state: ctx.state, days: "60" } },
    { id: "noaa_storm_events", params: { state: ctx.state, days: "30" } },
    { id: "ffiec_hmda", params: { state: ctx.state } },
    { id: "epa_lead_lines", params: { state: ctx.state } },
    { id: "epa_rrp", params: { state: ctx.state } },
  ];
  const out = await useSourcesParallel<any>(sb, calls);
  return [
    ...mapHudVacancy(out.hud_uspsvacancy?.data ?? [], ctx),
    ...mapFema(out.fema_disasters?.data ?? [], ctx),
    ...mapNoaa(out.noaa_storm_events?.data ?? [], ctx),
    ...mapHmda(out.ffiec_hmda?.data ?? [], ctx),
    ...mapEpaLead(out.epa_lead_lines?.data ?? [], ctx),
    ...mapEpaRrp(out.epa_rrp?.data ?? [], ctx),
  ];
}

// TechAlert / hire signals subset.
export async function fetchHireSignals(sb: SupabaseClient, ctx: SignalContext): Promise<Signal[]> {
  const calls: SourceCall[] = [
    { id: "dol_warn", params: { state: ctx.state } },
    { id: "osha_establishment", params: { state: ctx.state, naics: ctx.naics ?? "238220" } },
    { id: "osha_sir", params: { state: ctx.state } },
    { id: "sam_gov_opps_expanded", params: { naics: ctx.naics ?? "238220" } },
    { id: "fmcsa_mcs150", params: { state: ctx.state } },
    { id: "state_dot_prequalified", params: { lookup_url: "" } },
  ];
  const out = await useSourcesParallel<any>(sb, calls);
  return [
    ...mapDolWarn(out.dol_warn?.data ?? [], ctx),
    ...mapOshaInsp(out.osha_establishment?.data ?? [], ctx),
    ...mapOshaSir(out.osha_sir?.data ?? [], ctx),
    ...mapSam(out.sam_gov_opps_expanded?.data ?? [], ctx),
    ...mapFmcsa(out.fmcsa_mcs150?.data ?? [], ctx),
    ...mapDotPrequal(out.state_dot_prequalified?.data ?? [], ctx),
  ];
}

// Outreach discovery — fresh LLC formations as "no incumbent vendor" targets.
export async function fetchFreshBusinessSignals(sb: SupabaseClient, ctx: SignalContext): Promise<Signal[]> {
  const calls: SourceCall[] = [{ id: "state_corp_filings_rss", params: { feed_url: "" } }];
  const out = await useSourcesParallel<any>(sb, calls);
  return mapStateCorpRss(out.state_corp_filings_rss?.data ?? [], ctx);
}
