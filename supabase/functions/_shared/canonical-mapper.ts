// Canonical mapper — normalizes raw scanner output rows into the canonical
// schema (companies / people / places / events / signals) using rules stored
// in `scanner_source_mappings`. Falls back to category-template heuristics for
// unmapped sources so every new fetcher participates in shared targeting logic
// from day one.
//
// Usage from a scanner / dispatcher:
//   import { persistCanonicalRows } from "../_shared/canonical-mapper.ts";
//   await persistCanonicalRows(sb, { source, product, rows });

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SourceMapping = {
  source: string;
  product: string;
  entity_type: "company" | "person" | "place" | "area" | "event_only";
  event_type: string;
  event_category:
    | "weather" | "permit" | "legal" | "financial" | "hiring"
    | "directory" | "registry" | "web" | "property" | "enrichment";
  scope: "address" | "parcel" | "zip" | "county" | "region" | "state" | "company";
  default_score: number;
  default_urgency: string;
  target_products: string[];
  field_map: Record<string, string>;
  enabled: boolean;
};

// Category → default mapping template. Used when a source has no explicit
// registry row. Keeps unmapped sources participating in canonical pipeline.
const CATEGORY_TEMPLATES: Record<string, Partial<SourceMapping>> = {
  weather:    { entity_type: "area", event_category: "weather",    scope: "zip",     default_score: 6, event_type: "weather_alert" },
  permit:     { entity_type: "place", event_category: "permit",    scope: "address", default_score: 7, event_type: "permit_issued" },
  legal:      { entity_type: "company", event_category: "legal",   scope: "company", default_score: 6, event_type: "legal_filing" },
  financial:  { entity_type: "company", event_category: "financial",scope: "company",default_score: 6, event_type: "financial_signal" },
  hiring:     { entity_type: "company", event_category: "hiring",  scope: "company", default_score: 7, event_type: "hiring_signal" },
  directory:  { entity_type: "company", event_category: "directory",scope: "company",default_score: 4, event_type: "directory_listing" },
  registry:   { entity_type: "company", event_category: "registry",scope: "company", default_score: 5, event_type: "registry_record" },
  web:        { entity_type: "company", event_category: "web",     scope: "company", default_score: 5, event_type: "web_signal" },
  property:   { entity_type: "place", event_category: "property",  scope: "address", default_score: 6, event_type: "property_signal" },
  enrichment: { entity_type: "person", event_category: "enrichment",scope: "company",default_score: 4, event_type: "contact_enriched" },
};

// Heuristic fallback: infer category from source slug keywords.
export function inferCategory(source: string): keyof typeof CATEGORY_TEMPLATES {
  const s = source.toLowerCase();
  if (/(storm|weather|nws|noaa|drought|spc|hail|wind|flood|lightning|heat)/.test(s)) return "weather";
  if (/(permit|bseed|building|construction|inspection|demolition|cofa|cofc)/.test(s)) return "permit";
  if (/(court|opinion|docket|bankruptcy|foreclosure|legal|justia|circuit|coa|disciplinary|adb|sec_litigation)/.test(s)) return "legal";
  if (/(loan|hmda|fdic|fred|fhfa|sba|ucc|nmls|cfpb|complaint|fed)/.test(s)) return "financial";
  if (/(usajobs|job|hiring|warn|h1b|perm|nlrb|miosha|osha)/.test(s)) return "hiring";
  if (/(yelp|yellowpages|manta|merchantcircle|citysquares|wellfound|crunchbase|directory|places|foursquare|nominatim|opencage|here|mapquest|osm|superpages|glassdoor|indeed)/.test(s)) return "directory";
  if (/(propublica|sam_entity|nonprofit|edgar|patent|grant|nsf|nih|registry|filing|lara|sos|business_license)/.test(s)) return "registry";
  if (/(common_crawl|wayback|bing|reddit|github|scholar|crossref|orcid|sitemap|twitter|nitter|dns|whois|schema|cert|ct_log)/.test(s)) return "web";
  if (/(vacancy|parcel|deed|sale|sheriff|tax|zillow|redfin|realtor|trulia|landbank|estate|probate)/.test(s)) return "property";
  if (/(apollo|hunter|snov|pdl|clearbit|firecrawl|ipinfo|abuseipdb|ipapi|asn|rdap|peeringdb|maxmind|enrich)/.test(s)) return "enrichment";
  return "registry"; // safest default
}

// Resolve a possibly nested field path: "owner.email" or "address[0]"
function pluck(obj: any, path: string | undefined): any {
  if (!path || obj == null) return undefined;
  const parts = path.replace(/\[(\d+)]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function firstNonEmpty(row: any, fields: string[]): any {
  for (const f of fields) {
    const v = pluck(row, f);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Default fields each event tries to fill when field_map is incomplete.
const COMMON_FIELDS = {
  company_name: ["company_name", "business_name", "name", "org", "organization", "company", "entity"],
  domain:       ["domain", "website_domain", "website"],
  email:        ["email", "owner_email", "contact_email", "person_email"],
  phone:        ["phone", "owner_phone", "contact_phone", "tel"],
  full_name:    ["full_name", "owner_name", "contact_name", "person_name", "name"],
  address:      ["address", "address_line1", "street", "formatted_address", "site_address"],
  city:         ["city", "town", "locality"],
  state:        ["state", "region_code", "st"],
  zip:          ["zip", "zipcode", "postal_code", "zip_code"],
  county:       ["county"],
  parcel_id:    ["parcel_id", "parcel", "parcel_number"],
  lat:          ["lat", "latitude", "y"],
  lon:          ["lon", "lng", "longitude", "x"],
  external_id:  ["id", "external_id", "permit_number", "case_number", "docket", "ticket_id", "uid"],
  occurred_at:  ["occurred_at", "issued_date", "filed_date", "event_date", "date", "signal_date", "timestamp", "created"],
  title:        ["title", "work_description", "description", "headline", "subject"],
  description:  ["description", "body", "details"],
  estimated_value: ["estimated_value", "value", "amount", "amt_estimated_contractor_cost", "loan_amount"],
  url:          ["url", "link", "source_url"],
};

function getField(map: Record<string, string>, row: any, key: keyof typeof COMMON_FIELDS): any {
  const explicit = map[key];
  if (explicit) {
    const v = pluck(row, explicit);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return firstNonEmpty(row, COMMON_FIELDS[key]);
}

function formatAddress(addr: string | undefined, city: string | undefined, state: string | undefined, zip: string | undefined): string | null {
  const parts = [addr, [city, state].filter(Boolean).join(", "), zip].filter(Boolean);
  const s = parts.join(" ").trim();
  return s || null;
}

function asTimestamp(v: any): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  // ArcGIS-style numeric epoch ms
  if (typeof v === "number") return new Date(v).toISOString();
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

// In-process cache of mappings keyed by source
const MAPPING_CACHE = new Map<string, SourceMapping | null>();
let CACHE_TS = 0;
const CACHE_TTL_MS = 60_000;

export async function loadMapping(sb: SupabaseClient, source: string): Promise<SourceMapping | null> {
  const now = Date.now();
  if (now - CACHE_TS > CACHE_TTL_MS) {
    MAPPING_CACHE.clear();
    CACHE_TS = now;
  }
  if (MAPPING_CACHE.has(source)) return MAPPING_CACHE.get(source) ?? null;
  const { data } = await sb
    .from("scanner_source_mappings")
    .select("*")
    .eq("source", source)
    .maybeSingle();
  const row = (data as SourceMapping | null) ?? null;
  MAPPING_CACHE.set(source, row);
  return row;
}

// Build an effective mapping from the registry row (or category fallback).
export function effectiveMapping(source: string, product: string, registered: SourceMapping | null): SourceMapping {
  if (registered) return registered;
  const cat = inferCategory(source);
  const tpl = CATEGORY_TEMPLATES[cat]!;
  return {
    source,
    product,
    entity_type: (tpl.entity_type as any) ?? "event_only",
    event_type: tpl.event_type ?? `${cat}_signal`,
    event_category: tpl.event_category as any,
    scope: tpl.scope as any,
    default_score: tpl.default_score ?? 5,
    default_urgency: "normal",
    target_products: [product],
    field_map: {},
    enabled: true,
  };
}

// Upsert helper that swallows uniqueness errors and returns the existing row's id.
async function upsertReturningId(
  sb: SupabaseClient,
  table: string,
  insertRow: Record<string, any>,
  lookup: { column: string; value: any } | null,
): Promise<string | null> {
  if (lookup && (lookup.value === null || lookup.value === undefined || lookup.value === "")) {
    // No dedup key — insert blind
    const { data, error } = await sb.from(table).insert(insertRow).select("id").single();
    if (error) return null;
    return (data as any)?.id ?? null;
  }
  // Try insert; on conflict, fetch existing
  const { data: ins, error: insErr } = await sb.from(table).insert(insertRow).select("id").single();
  if (!insErr) return (ins as any)?.id ?? null;
  if (!lookup) return null;
  const { data: found } = await sb.from(table).select("id").eq(lookup.column, lookup.value).maybeSingle();
  return (found as any)?.id ?? null;
}

export type MappedResult = {
  company_id: string | null;
  person_id: string | null;
  place_id: string | null;
  event_id: string | null;
  signal_id: string | null;
};

export async function persistCanonicalRow(
  sb: SupabaseClient,
  args: { source: string; product: string; row: any; segment?: string },
): Promise<MappedResult> {
  const out: MappedResult = { company_id: null, person_id: null, place_id: null, event_id: null, signal_id: null };
  const reg = await loadMapping(sb, args.source);
  const m = effectiveMapping(args.source, args.product, reg);
  if (!m.enabled) return out;

  const row = args.row || {};
  const fm = m.field_map || {};

  // Company
  const companyName = getField(fm, row, "company_name");
  if (companyName) {
    const domain = getField(fm, row, "domain");
    const lookup = domain
      ? { column: "domain", value: String(domain).toLowerCase() }
      : { column: "name", value: companyName };
    out.company_id = await upsertReturningId(sb, "canonical_companies", {
      name: String(companyName).slice(0, 500),
      domain: domain ? String(domain).toLowerCase() : null,
      city: getField(fm, row, "city") || null,
      state: getField(fm, row, "state") || null,
      zip: getField(fm, row, "zip") || null,
      phone: getField(fm, row, "phone") || null,
      first_seen_source: args.source,
      meta: { from_source: args.source },
    }, lookup);
  }

  // Person
  const fullName = getField(fm, row, "full_name");
  const email = getField(fm, row, "email");
  if (fullName || email) {
    const lookup = email ? { column: "email", value: String(email).toLowerCase() } : null;
    out.person_id = await upsertReturningId(sb, "canonical_people", {
      full_name: fullName ? String(fullName).slice(0, 300) : (email ? String(email) : "unknown"),
      email: email ? String(email).toLowerCase() : null,
      phone: getField(fm, row, "phone") || null,
      company_id: out.company_id,
      first_seen_source: args.source,
      meta: { from_source: args.source },
    }, lookup);
  }

  // Place
  const address = getField(fm, row, "address");
  const zip = getField(fm, row, "zip");
  const county = getField(fm, row, "county");
  if (address || zip || county) {
    const formatted = formatAddress(address, getField(fm, row, "city"), getField(fm, row, "state"), zip);
    const lookup = formatted ? { column: "formatted_address", value: formatted.toLowerCase() } : null;
    out.place_id = await upsertReturningId(sb, "canonical_places", {
      address_line1: address ? String(address).slice(0, 500) : null,
      city: getField(fm, row, "city") || null,
      state: getField(fm, row, "state") || null,
      zip: zip ? String(zip) : null,
      county: county || null,
      parcel_id: getField(fm, row, "parcel_id") || null,
      lat: getField(fm, row, "lat") || null,
      lon: getField(fm, row, "lon") || null,
      scope: m.scope === "company" ? "address" : (m.scope as any),
      formatted_address: formatted,
      meta: { from_source: args.source },
    }, lookup);
  }

  // Event
  const occurred_at = asTimestamp(getField(fm, row, "occurred_at"));
  const externalId = getField(fm, row, "external_id");
  const event = {
    event_type: m.event_type,
    event_category: m.event_category,
    source: args.source,
    product: args.product,
    occurred_at,
    company_id: out.company_id,
    person_id: out.person_id,
    place_id: out.place_id,
    external_id: externalId ? String(externalId).slice(0, 200) : null,
    title: getField(fm, row, "title") ? String(getField(fm, row, "title")).slice(0, 500) : null,
    description: getField(fm, row, "description") ? String(getField(fm, row, "description")).slice(0, 2000) : null,
    estimated_value: typeof getField(fm, row, "estimated_value") === "number" ? getField(fm, row, "estimated_value") : null,
    url: getField(fm, row, "url") || null,
    raw: row,
    meta: { mapping_source: reg ? "registry" : "fallback_template" },
  };

  // Upsert event with source+external_id dedup; if no external_id, blind insert
  if (externalId) {
    const { data: existing } = await sb
      .from("canonical_events")
      .select("id")
      .eq("source", args.source)
      .eq("external_id", String(externalId))
      .maybeSingle();
    if (existing) {
      out.event_id = (existing as any).id;
    } else {
      const { data: ins } = await sb.from("canonical_events").insert(event).select("id").single();
      out.event_id = (ins as any)?.id ?? null;
    }
  } else {
    const { data: ins } = await sb.from("canonical_events").insert(event).select("id").single();
    out.event_id = (ins as any)?.id ?? null;
  }

  if (!out.event_id) return out;

  // Fan out signals to every target product (default: just this product)
  const products = m.target_products?.length ? m.target_products : [args.product];
  for (const p of products) {
    const { data: sig } = await sb
      .from("canonical_signals")
      .insert({
        event_id: out.event_id,
        product: p,
        segment: args.segment ?? null,
        score: m.default_score,
        urgency: m.default_urgency as any,
        scope: m.scope,
        target_company_id: out.company_id,
        target_person_id: out.person_id,
        target_place_id: out.place_id,
      })
      .select("id")
      .single();
    if (sig && !out.signal_id) out.signal_id = (sig as any).id;
  }

  return out;
}

export async function persistCanonicalRows(
  sb: SupabaseClient,
  args: { source: string; product: string; rows: any[]; segment?: string; limit?: number },
): Promise<{ inserted: number; signals: number; errors: number }> {
  const cap = args.limit ?? 100;
  const rows = (args.rows || []).slice(0, cap);
  let inserted = 0, signals = 0, errors = 0;
  for (const r of rows) {
    try {
      const res = await persistCanonicalRow(sb, { source: args.source, product: args.product, row: r, segment: args.segment });
      if (res.event_id) inserted++;
      if (res.signal_id) signals++;
    } catch {
      errors++;
    }
  }
  return { inserted, signals, errors };
}
