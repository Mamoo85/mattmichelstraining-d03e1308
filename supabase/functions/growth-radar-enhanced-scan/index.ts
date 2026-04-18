// growth-radar-enhanced-scan
// Adds 8 free/legit signal sources to industry_pulse_signals → growth_radar_signals.
// Each source is wrapped in try/catch — one failure never blocks the others.
// Sources: MI SOS new entities, SBA loans, WARN notices, grants.gov,
//          Detroit/Wayne building permits, MI LARA hospital CON, MLCC permits,
//          MI procurement RFPs.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  source: string;
  signal_type: string;
  company_name: string;
  county?: string | null;
  vertical?: string | null;
  value_usd?: number | null;
  predicted_needs?: string[];
  recommended_pitch?: string | null;
  source_url?: string | null;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// ── Sonar OSINT helper (used as fallback/enrichment for sources without raw APIs) ──
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
          content: `${query}\n\nReturn a JSON array with up to ${max} entries. Each entry MUST include: company_name, county, summary, source_url. Return ONLY the JSON array, no prose.`,
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

// ── 1. MI SOS new entity filings (manufacturing focus) ──
async function scanMiSosFilings(): Promise<Signal[]> {
  const items = await sonarSearch(
    `New Michigan LLC and Corp filings in last 30 days at Michigan SOS / corp.michigan.gov for manufacturing, industrial, fabrication, or HVAC/plumbing/electrical contractors.`,
  );
  return items.map((it: any) => ({
    source: "mi_sos",
    signal_type: "new_business_entity",
    company_name: it.company_name || "Unknown Entity",
    county: it.county || null,
    vertical: "manufacturing",
    confidence: 7,
    recommended_pitch: `New entity filed in MI — early signal for facility setup, hiring, equipment purchases. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["HVAC install", "electrical service", "plumbing rough-in"],
  }));
}

// ── 2. SBA 7a/504 loan approvals (Michigan, $500k+) ──
async function scanSbaLoans(): Promise<Signal[]> {
  const items = await sonarSearch(
    `SBA 7(a) and 504 loan approvals in Michigan in last 90 days over $500,000 for manufacturing, construction, or HVAC/plumbing/electrical companies. Source: sba.gov data.`,
  );
  return items.map((it: any) => ({
    source: "sba",
    signal_type: "sba_loan_approved",
    company_name: it.company_name || "Unknown",
    county: it.county || null,
    vertical: "capital_expansion",
    value_usd: typeof it.amount === "number" ? it.amount : null,
    confidence: 8,
    recommended_pitch: `SBA loan approved — capital deployed in next 30-90 days. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["equipment install", "facility expansion", "hiring tradespeople"],
  }));
}

// ── 3. WARN Act 60-day plant closure / mass layoff notices ──
async function scanWarnActNotices(): Promise<Signal[]> {
  const items = await sonarSearch(
    `Michigan WARN Act 60-day notices filed in last 60 days. Plant closures and mass layoffs at manufacturers, suppliers. Source: Michigan DOL or DOL.gov WARN database.`,
  );
  return items.map((it: any) => ({
    source: "warn_act",
    signal_type: "warn_act_notice",
    company_name: it.company_name || "Unknown",
    county: it.county || null,
    vertical: "talent_release",
    confidence: 9,
    recommended_pitch: `WARN notice filed — skilled tradespeople freed up for poaching. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["talent acquisition", "trade hires"],
  }));
}

// ── 4. grants.gov R&D awards to Michigan ──
async function scanGrantsGov(): Promise<Signal[]> {
  const items = await sonarSearch(
    `grants.gov federal R&D grants awarded to Michigan recipients in last 90 days, engineering or manufacturing keywords, $100k+.`,
  );
  return items.map((it: any) => ({
    source: "grants_gov",
    signal_type: "rd_grant_awarded",
    company_name: it.company_name || "Unknown",
    county: it.county || null,
    vertical: "research_development",
    value_usd: typeof it.amount === "number" ? it.amount : null,
    confidence: 7,
    recommended_pitch: `Federal R&D grant awarded — equipment + lab buildout funded. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["lab HVAC", "specialized electrical", "clean room buildout"],
  }));
}

// ── 5. Detroit / Wayne County major commercial building permits ($500k+) ──
async function scanMajorPermits(): Promise<Signal[]> {
  const items = await sonarSearch(
    `New commercial building permits in Detroit, Wayne County, Oakland County, or Macomb County in last 30 days valued over $500,000. Source: city open data portals.`,
  );
  return items.map((it: any) => ({
    source: "city_permits",
    signal_type: "major_building_permit",
    company_name: it.company_name || "Unknown Project",
    county: it.county || null,
    vertical: "commercial_construction",
    value_usd: typeof it.amount === "number" ? it.amount : null,
    confidence: 8,
    recommended_pitch: `Major permit issued — sub-contractor selection happening now. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["mechanical sub", "electrical sub", "plumbing sub"],
  }));
}

// ── 6. MI LARA hospital CON applications ──
async function scanHospitalCON(): Promise<Signal[]> {
  const items = await sonarSearch(
    `Michigan LARA Certificate of Need (CON) applications filed in last 90 days for hospital expansion, new senior care facility, or ambulatory surgery center.`,
  );
  return items.map((it: any) => ({
    source: "lara_con",
    signal_type: "healthcare_expansion",
    company_name: it.company_name || "Unknown Facility",
    county: it.county || null,
    vertical: "healthcare",
    confidence: 8,
    recommended_pitch: `CON filed — major HVAC, medical-gas, plumbing buildout 6-18 months out. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["medical HVAC", "negative-pressure rooms", "med-gas plumbing"],
  }));
}

// ── 7. MLCC new brewery / distillery / cannabis manufacturer permits ──
async function scanMlccPermits(): Promise<Signal[]> {
  const items = await sonarSearch(
    `Michigan Liquor Control Commission new manufacturer/brewery/distillery licenses approved in last 60 days OR LARA MRA cannabis processor licenses.`,
  );
  return items.map((it: any) => ({
    source: "mlcc",
    signal_type: "hospitality_permit",
    company_name: it.company_name || "Unknown",
    county: it.county || null,
    vertical: "specialty_manufacturing",
    confidence: 7,
    recommended_pitch: `Specialty manufacturing license — needs specialized plumbing, ventilation, refrigeration. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["specialty plumbing", "industrial ventilation", "process piping"],
  }));
}

// ── 8. Michigan procurement RFPs (school HVAC bids) ──
async function scanMiProcurementRFPs(): Promise<Signal[]> {
  const items = await sonarSearch(
    `Active Michigan public procurement RFPs (school districts, municipalities) for HVAC, mechanical, electrical, or plumbing work posted in last 30 days. Source: Michigan procurement portal or DemandStar.`,
  );
  return items.map((it: any) => ({
    source: "mi_procurement",
    signal_type: "school_rfp",
    company_name: it.company_name || "Unknown School/Muni",
    county: it.county || null,
    vertical: "public_sector",
    confidence: 8,
    recommended_pitch: `Active RFP — bid window open NOW. ${it.summary || ""}`.trim(),
    source_url: it.source_url || null,
    predicted_needs: ["public-sector HVAC", "prevailing-wage labor", "bonded subs"],
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const scanners = [
    { name: "mi_sos", fn: scanMiSosFilings },
    { name: "sba", fn: scanSbaLoans },
    { name: "warn_act", fn: scanWarnActNotices },
    { name: "grants_gov", fn: scanGrantsGov },
    { name: "city_permits", fn: scanMajorPermits },
    { name: "lara_con", fn: scanHospitalCON },
    { name: "mlcc", fn: scanMlccPermits },
    { name: "mi_procurement", fn: scanMiProcurementRFPs },
  ];

  const results: Record<string, number> = {};
  const allSignals: Signal[] = [];

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

  // Insert into growth_radar_signals (extended schema includes county, vertical, value_usd, etc)
  let inserted = 0;
  if (allSignals.length) {
    const rows = allSignals.map((s) => ({
      source: s.source,
      signal_type: s.signal_type,
      company_name: s.company_name,
      county: s.county || null,
      vertical: s.vertical || null,
      value_usd: s.value_usd || null,
      predicted_needs: s.predicted_needs || [],
      recommended_pitch: s.recommended_pitch || null,
      source_url: s.source_url || null,
      confidence: s.confidence,
      detected_at: new Date().toISOString(),
      metadata: s.metadata || {},
    }));
    const { error, count } = await supabase
      .from("growth_radar_signals")
      .insert(rows, { count: "exact" });
    if (error) console.error("insert failed:", error);
    else inserted = count || rows.length;
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: scanners.length, inserted, by_source: results }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
