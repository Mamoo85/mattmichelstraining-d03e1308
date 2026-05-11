// Automated QA checks for canonical normalization.
//
// Runs BEFORE we write to canonical_events / canonical_signals (and their
// child rows). Rows that fail hard checks are routed to
// `canonical_qa_quarantine` instead of polluting the targeting feed.
//
// Two layers:
//   1. Schema validation — required fields by entity_type / scope are present
//      and well-formed (sane occurred_at, sane scores, no junk strings).
//   2. Field completeness — score 0–100 across the canonical contact +
//      geo fields. Below a per-source/per-category floor → quarantine.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SourceMapping } from "./canonical-mapper.ts";

export type QaCandidate = {
  // Canonical company fields
  company_name?: string | null;
  domain?: string | null;
  // Canonical person fields
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  // Canonical place fields
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  lat?: number | null;
  lon?: number | null;
  // Event fields
  external_id?: string | null;
  occurred_at?: string | Date | number | null;
  title?: string | null;
  description?: string | null;
  estimated_value?: number | null;
  url?: string | null;
};

export type QaResult = {
  ok: boolean;            // false = quarantine, do not persist
  severity: "reject" | "warn" | "pass";
  reasons: string[];      // machine-readable reason codes
  completeness: number;   // 0–100
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const STATE_RE = /^[A-Za-z]{2}$/;
const PHONE_DIGITS_RE = /\d/g;

function isStr(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function digits(v: string): string {
  return (v.match(PHONE_DIGITS_RE) || []).join("");
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Per-entity required fields. A row missing any of these for its declared
// entity_type is a hard reject (routed to quarantine, never persisted).
const REQUIRED_BY_ENTITY: Record<string, (keyof QaCandidate)[]> = {
  company:    ["company_name"],
  person:     [],           // person needs name OR email — handled below
  place:      [],           // place needs address OR zip OR county
  area:       [],           // area needs zip / county / state — handled below
  event_only: [],
};

// Completeness weights (sum can exceed 100; we cap at 100).
const WEIGHTS: Record<keyof QaCandidate, number> = {
  company_name: 15, domain: 10,
  full_name: 8, email: 12, phone: 10,
  address: 12, city: 5, state: 5, zip: 5, county: 3, lat: 3, lon: 3,
  external_id: 5, occurred_at: 8, title: 3, description: 2, estimated_value: 2, url: 2,
};

// Per-category minimum completeness floor. Below this → quarantine (warn).
const MIN_COMPLETENESS: Record<string, number> = {
  weather: 15,     // area-only signals are sparse by design
  permit: 35,
  legal: 25,
  financial: 25,
  hiring: 30,
  directory: 30,
  registry: 25,
  web: 20,
  property: 30,
  enrichment: 35,
};

export function validateCandidate(
  candidate: QaCandidate,
  mapping: Pick<SourceMapping, "entity_type" | "event_category" | "scope" | "default_score">,
): QaResult {
  const reasons: string[] = [];

  // --- Schema checks (hard) ----------------------------------------------
  if (candidate.email && !EMAIL_RE.test(String(candidate.email))) reasons.push("invalid_email");
  if (candidate.url && !URL_RE.test(String(candidate.url))) reasons.push("invalid_url");
  if (candidate.zip && !ZIP_RE.test(String(candidate.zip).trim())) reasons.push("invalid_zip");
  if (candidate.state && !STATE_RE.test(String(candidate.state).trim())) reasons.push("invalid_state");
  if (candidate.phone && digits(String(candidate.phone)).length < 10) reasons.push("invalid_phone");
  if (candidate.lat != null && (Number(candidate.lat) < -90 || Number(candidate.lat) > 90)) reasons.push("invalid_lat");
  if (candidate.lon != null && (Number(candidate.lon) < -180 || Number(candidate.lon) > 180)) reasons.push("invalid_lon");
  if (candidate.estimated_value != null && (typeof candidate.estimated_value !== "number" || candidate.estimated_value < 0)) {
    reasons.push("invalid_estimated_value");
  }

  const occ = parseDate(candidate.occurred_at);
  if (candidate.occurred_at != null && !occ) {
    reasons.push("invalid_occurred_at");
  } else if (occ) {
    const ageDays = (Date.now() - occ.getTime()) / 86_400_000;
    if (ageDays < -1) reasons.push("future_occurred_at");      // >24h in the future
    if (ageDays > 365 * 5) reasons.push("stale_occurred_at");  // >5y old
  }

  // --- Entity-required fields -------------------------------------------
  const ent = mapping.entity_type;
  const required = REQUIRED_BY_ENTITY[ent] || [];
  for (const f of required) {
    if (!isStr(candidate[f] as any)) reasons.push(`missing_${f}`);
  }
  if (ent === "person" && !isStr(candidate.full_name) && !isStr(candidate.email)) {
    reasons.push("missing_person_identity");
  }
  if (ent === "place" && !isStr(candidate.address) && !isStr(candidate.zip) && !isStr(candidate.county)) {
    reasons.push("missing_place_anchor");
  }
  if (ent === "area" && !isStr(candidate.zip) && !isStr(candidate.county) && !isStr(candidate.state)) {
    reasons.push("missing_area_anchor");
  }

  // Scope-required geo
  if (mapping.scope === "address" && !isStr(candidate.address)) reasons.push("missing_address_for_scope");
  if (mapping.scope === "zip" && !isStr(candidate.zip)) reasons.push("missing_zip_for_scope");
  if (mapping.scope === "county" && !isStr(candidate.county)) reasons.push("missing_county_for_scope");

  // --- Completeness score -----------------------------------------------
  let score = 0;
  for (const [k, w] of Object.entries(WEIGHTS) as [keyof QaCandidate, number][]) {
    const v = candidate[k];
    if (v == null || v === "") continue;
    if (typeof v === "number") { score += w; continue; }
    if (isStr(v as any)) { score += w; continue; }
  }
  const completeness = Math.min(100, score);

  // Severity:
  //   reject — any schema/entity violation. Never persists.
  //   warn   — passes schema but below completeness floor. Quarantined.
  //   pass   — go.
  const hardFail = reasons.some((r) =>
    r.startsWith("invalid_") || r.startsWith("missing_") || r === "future_occurred_at"
  );
  if (hardFail) return { ok: false, severity: "reject", reasons, completeness };

  const floor = MIN_COMPLETENESS[mapping.event_category] ?? 25;
  if (completeness < floor) {
    reasons.push(`low_completeness_${completeness}_lt_${floor}`);
    return { ok: false, severity: "warn", reasons, completeness };
  }

  return { ok: true, severity: "pass", reasons, completeness };
}

export async function quarantine(
  sb: SupabaseClient,
  args: {
    source: string;
    product: string;
    segment?: string;
    mapping: Pick<SourceMapping, "event_type" | "event_category" | "scope">;
    candidate: QaCandidate;
    raw: any;
    result: QaResult;
  },
): Promise<void> {
  try {
    await sb.from("canonical_qa_quarantine").insert({
      source: args.source,
      product: args.product,
      segment: args.segment ?? null,
      event_type: args.mapping.event_type,
      event_category: args.mapping.event_category,
      scope: args.mapping.scope,
      reasons: args.result.reasons,
      severity: args.result.severity === "pass" ? "warn" : args.result.severity,
      completeness: args.result.completeness,
      candidate: args.candidate as any,
      raw: args.raw ?? null,
    });
  } catch {
    // Never let QA logging break ingestion.
  }
}
