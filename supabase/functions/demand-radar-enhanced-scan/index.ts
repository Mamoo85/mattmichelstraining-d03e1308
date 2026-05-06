// demand-radar-enhanced-scan
// 6 free/legit signal sources for contractor demand intelligence.
// Sources: MIOSHA boiler cert expirations, MIOSHA electrical/HVAC violations,
//          county HVAC permit volume, MDARD restaurant ventilation failures,
//          Census multi-family housing starts, LARA MRA cannabis buildouts.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemandSignal {
  company_name: string;
  location?: string | null;
  county?: string | null;
  zip?: string | null;
  vertical?: string | null;
  signal_type: string;
  industry?: string | null;
  expansion_type?: string | null;
  hiring_count?: number | null;
  predicted_needs?: string[];
  confidence: number;
  recommended_pitch?: string | null;
  source_urls?: string[];
  cross_referenced?: boolean;
}

async function sonarSearch(query: string, max = 6): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{
          role: "user",
          content: `${query}\n\nReturn a JSON array with up to ${max} entries. Each entry MUST include: company_name, location (city), county, summary, source_url. Return ONLY the JSON array, no prose.`,
        }],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    const json = await res.json();
    const txt = (json.choices?.[0]?.message?.content || "").replace(/```json|```/gi, "").trim();
    const start = txt.indexOf("[");
    const end = txt.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    return JSON.parse(txt.slice(start, end + 1));
  } catch (e) {
    console.error("sonarSearch failed:", e);
    return [];
  }
}

// ── 1. MIOSHA boiler cert expirations (30/60/90 day windows) ──
async function scanBoilerCertExpiry(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan MIOSHA boiler certificates expiring in next 30, 60, or 90 days. Facilities needing licensed boiler operator or recertification. Source: MIOSHA boiler division.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Facility",
    location: it.location || null,
    county: it.county || null,
    vertical: "industrial",
    signal_type: "boiler_cert_expiry",
    confidence: 9,
    recommended_pitch: `Boiler cert expiring — facility needs licensed operator NOW or risk shutdown. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["licensed boiler operator", "annual inspection", "compliance audit"],
  }));
}

// ── 2. MIOSHA electrical / HVAC violations in last 90 days ──
async function scanMioshaViolations(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan MIOSHA inspection records with electrical, HVAC, mechanical, or boiler violations in last 90 days. Companies needing compliant trades urgently.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown",
    location: it.location || null,
    county: it.county || null,
    vertical: "industrial",
    signal_type: "miosha_violation",
    confidence: 8,
    recommended_pitch: `MIOSHA violation cited — needs licensed contractor remediation. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["compliance remediation", "licensed electrical/HVAC", "follow-up inspection"],
  }));
}

// ── 3. Residential HVAC permit volume by zip (Metro Detroit) ──
async function scanHvacPermitSurge(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Residential HVAC permits issued in Metro Detroit zip codes in last 30 days. High-volume zips signal HVAC demand cluster.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || `Zip ${it.zip || "?"} HVAC cluster`,
    location: it.location || null,
    county: it.county || null,
    zip: it.zip || null,
    vertical: "residential",
    signal_type: "hvac_permit_surge",
    confidence: 7,
    recommended_pitch: `HVAC permit surge in this zip — neighborhood-level marketing opportunity. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["residential HVAC install", "duct work", "thermostat upgrades"],
  }));
}

// ── 4. MDARD restaurant ventilation / hood failures ──
async function scanRestaurantHoodFailures(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan MDARD food service inspection failures in last 60 days mentioning ventilation, hood, exhaust, or kitchen HVAC issues.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Restaurant",
    location: it.location || null,
    county: it.county || null,
    vertical: "hospitality",
    signal_type: "kitchen_hood_failure",
    confidence: 9,
    recommended_pitch: `Restaurant cited for ventilation issue — must remediate to keep operating. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["commercial hood install", "kitchen exhaust cleaning", "make-up air"],
  }));
}

// ── 5. Census multi-family housing starts ──
async function scanMultiFamilyStarts(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Census Bureau Building Permits Survey — Michigan multi-family (5+ unit) housing starts in last 90 days. New apartment/condo projects entering rough-in phase.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Project",
    location: it.location || null,
    county: it.county || null,
    vertical: "multifamily",
    signal_type: "multifamily_starts",
    expansion_type: "new_construction",
    confidence: 8,
    recommended_pitch: `Multi-family project — sustained mechanical/plumbing/electrical demand 6-18 months. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["bulk plumbing", "unit HVAC", "service electrical"],
  }));
}

// ── 6. Cannabis dispensary/grow buildout permits (LARA MRA) ──
async function scanCannabisHvac(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan LARA Marijuana Regulatory Agency licensed cannabis cultivation/processing facility expansions or new buildouts in last 60 days. Specialized HVAC and grow-room electrical demand.`,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Cultivator",
    location: it.location || null,
    county: it.county || null,
    vertical: "cannabis",
    signal_type: "cannabis_hvac",
    confidence: 8,
    recommended_pitch: `Cannabis facility buildout — specialized grow-room HVAC + heavy electrical service. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["grow-room HVAC", "dehumidification", "heavy electrical service"],
  }));
}

// ── 7. OSHA violations — companies cited recently are growing workforce fast ──
async function scanOshaViolations(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan companies cited by OSHA for safety violations in the last 60 days. Construction, manufacturing, or industrial firms expanding workforce rapidly. Include company name, city, violation type.`,
    8,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Firm",
    location: it.location || null,
    county: it.county || null,
    vertical: "industrial",
    signal_type: "osha_violation_expansion",
    confidence: 7,
    recommended_pitch: `Company cited for OSHA violation — workforce expansion + compliance pressure. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["safety training", "compliance consulting", "PPE supply", "process audit"],
  }));
}

// ── 8. SBA loan recipients — fresh growth capital = active purchasing budget ──
async function scanSbaLoanRecipients(): Promise<DemandSignal[]> {
  const items = await sonarSearch(
    `Michigan small businesses that received SBA loans or SBA EIDL grants in the last 90 days. Construction, retail, restaurant, or trade businesses expanding. Include company name, city, loan amount if available.`,
    8,
  );
  return items.map((it: any) => ({
    company_name: it.company_name || "Unknown Business",
    location: it.location || null,
    county: it.county || null,
    vertical: "commercial",
    signal_type: "sba_loan_growth",
    confidence: 8,
    recommended_pitch: `SBA loan recipient — actively spending on business expansion. ${it.summary || ""}`.trim(),
    source_urls: it.source_url ? [it.source_url] : [],
    predicted_needs: ["equipment", "facility upgrades", "HVAC", "electrical", "web presence"],
  }));
}

import { withRunLog } from "../_shared/demand-radar-log.ts";

serve(withRunLog("demand-radar-enhanced-scan", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const scanners = [
    { name: "boiler_cert_expiry", fn: scanBoilerCertExpiry },
    { name: "miosha_violation", fn: scanMioshaViolations },
    { name: "hvac_permit_surge", fn: scanHvacPermitSurge },
    { name: "kitchen_hood_failure", fn: scanRestaurantHoodFailures },
    { name: "multifamily_starts", fn: scanMultiFamilyStarts },
    { name: "cannabis_hvac", fn: scanCannabisHvac },
    { name: "osha_violation", fn: scanOshaViolations },
    { name: "sba_loan", fn: scanSbaLoanRecipients },
  ];

  const results: Record<string, number> = {};
  const allSignals: DemandSignal[] = [];

  await Promise.all(scanners.map(async (s) => {
    try {
      const sigs = await s.fn();
      results[s.name] = sigs.length;
      allSignals.push(...sigs);
    } catch (e) {
      console.error(`${s.name} failed:`, e);
      results[s.name] = -1;
    }
  }));

  let inserted = 0;
  if (allSignals.length) {
    const rows = allSignals.map((s) => ({
      company_name: s.company_name,
      location: s.location || null,
      county: s.county || null,
      zip: s.zip || null,
      vertical: s.vertical || null,
      signal_type: s.signal_type,
      industry: s.industry || null,
      expansion_type: s.expansion_type || null,
      hiring_count: s.hiring_count || null,
      predicted_needs: s.predicted_needs || [],
      confidence: s.confidence,
      recommended_pitch: s.recommended_pitch || null,
      source_urls: s.source_urls || [],
      cross_referenced: s.cross_referenced || false,
      detected_at: new Date().toISOString(),
    }));
    const { error, count } = await supabase
      .from("demand_radar_signals")
      .insert(rows, { count: "exact" });
    if (error) console.error("insert failed:", error);
    else inserted = count || rows.length;
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: scanners.length, inserted, by_source: results, signals_found: allSignals.length, signals_new: inserted }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
}));
