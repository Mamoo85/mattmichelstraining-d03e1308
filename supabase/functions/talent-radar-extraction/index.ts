// talent-radar-extraction — Talent Radar Extraction Agent
//
// ROLE: Autonomous intelligence operative. Sole directive: retrieve deterministic
// licensing data from the Michigan Socrata Open Data API (SODA) and format it for
// immediate downstream enrichment.
//
// PROTOCOL:
//  - CONNECTION: SODA via X-App-Token header (MICHIGAN_SODA_APP_TOKEN). No headless browser.
//  - QUERY: SoQL filtered to last 24h, target trades only (HVAC, Plumbing, Electrical, Roofing).
//  - PAGINATION: $limit + $offset cursor loop until empty page.
//  - FIELDS: full_name, license_classification, issue_date, expiration_status, business_entity (DBA).
//  - QUEUE: Push raw matrix to Post-Extraction Enhancement Queue (hire_alert_candidates with
//           enrichment_status='pending' — picked up by existing candidate-deep-enrich worker).
//  - CONSTRAINT: Extraction only. Never guess emails/phones. Pass incomplete records through.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SODA_TOKEN = Deno.env.get("MICHIGAN_SODA_APP_TOKEN") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Target trade classifications (case-insensitive substrings matched against `profession`)
const TRADE_FILTERS: Record<string, string[]> = {
  hvac: ["MECHANICAL", "HVAC", "REFRIGERATION", "HEATING"],
  plumbing: ["PLUMB"],
  electrical: ["ELECTRIC"],
  roofing: ["ROOF"],
};

// Michigan LARA unified license dataset on data.michigan.gov
const SODA_DATASET = "midl-yni7";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // hard cap = 20k records / run

interface RawRecord {
  full_name: string;
  license_classification: string;
  issue_date: string | null;
  expiration_status: string;
  business_entity: string | null;
  vertical: string;
}

function buildSoQL(verticalKeywords: string[], sinceISO: string, offset: number) {
  // upper(profession) like '%KEYWORD%' OR ...
  const profClause = verticalKeywords
    .map((k) => `upper(profession) like '%${k}%'`)
    .join(" OR ");
  const where = `(${profClause}) AND issue_date >= '${sinceISO}'`;
  const params = new URLSearchParams({
    $where: where,
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
    $order: "issue_date DESC",
  });
  return `https://data.michigan.gov/resource/${SODA_DATASET}.json?${params.toString()}`;
}

async function fetchPage(url: string): Promise<any[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (SODA_TOKEN) headers["X-App-Token"] = SODA_TOKEN;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`[talent-radar] SODA ${res.status}: ${await res.text().catch(() => "")}`);
    return [];
  }
  return res.json();
}

function buildFullName(row: any): string {
  const first = (row.licensee_first_name || row.first_name || "").trim();
  const middle = (row.licensee_middle_name || row.middle_name || "").trim();
  const last = (row.licensee_last_name || row.last_name || "").trim();
  if (first || last) return [first, middle, last].filter(Boolean).join(" ");
  return (row.licensee_name || row.name || row.full_name || "").trim();
}

function expirationStatus(row: any): string {
  const exp = row.expiration_date || row.license_expiry_date;
  if (!exp) return "unknown";
  const expDate = new Date(exp);
  if (isNaN(expDate.getTime())) return "unknown";
  return expDate.getTime() < Date.now() ? "expired" : "active";
}

async function extractVertical(vertical: string, keywords: string[], sinceISO: string): Promise<RawRecord[]> {
  const out: RawRecord[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = buildSoQL(keywords, sinceISO, page * PAGE_SIZE);
    const rows = await fetchPage(url);
    if (!rows.length) break;
    for (const row of rows) {
      const full_name = buildFullName(row);
      if (!full_name) continue;
      out.push({
        full_name,
        license_classification: row.profession || row.license_type || "unknown",
        issue_date: row.issue_date || null,
        expiration_status: expirationStatus(row),
        business_entity: row.dba_name || row.business_name || row.entity_name || null,
        vertical,
      });
    }
    if (rows.length < PAGE_SIZE) break; // last page
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Last 24h window
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const verticalCounts: Record<string, number> = {};
  const allRaw: RawRecord[] = [];

  for (const [vertical, keywords] of Object.entries(TRADE_FILTERS)) {
    const recs = await extractVertical(vertical, keywords, sinceISO);
    verticalCounts[vertical] = recs.length;
    allRaw.push(...recs);
  }

  // Push to Post-Extraction Enhancement Queue (= hire_alert_candidates with enrichment_status='pending')
  let inserted = 0;
  let skipped = 0;
  for (const r of allRaw) {
    const payload: any = {
      name: r.full_name,
      trade: r.vertical,
      role: r.license_classification,
      license_number: null,
      license_status: r.expiration_status,
      license_issue_date: r.issue_date,
      company: r.business_entity,
      source: "soda_lara",
      score: 5, // neutral; enhancement layer will rescore
      enrichment_status: "pending",
      raw: r as any,
    };
    const { error } = await sb
      .from("hire_alert_candidates")
      .upsert(payload, { onConflict: "name,trade,source", ignoreDuplicates: true });
    if (error) skipped++;
    else inserted++;
  }

  // Log run
  await sb.from("hire_alert_runs").insert({
    run_at: new Date().toISOString(),
    source: "talent_radar_soda",
    candidates_found: allRaw.length,
    new_candidates: inserted,
    alerts_sent: 0,
    errors: skipped,
    status: "ok",
    completed_at: new Date().toISOString(),
    source_breakdown: verticalCounts as any,
  } as any);

  const summary = {
    ok: true,
    window_since: sinceISO,
    total_extracted: allRaw.length,
    queued_for_enrichment: inserted,
    skipped,
    by_vertical: verticalCounts,
    duration_ms: Date.now() - startedAt,
  };
  console.log(`[talent-radar-extraction] ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify(summary), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
