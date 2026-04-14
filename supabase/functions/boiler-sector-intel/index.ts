// boiler-sector-intel — Predictive sales intelligence for the industrial boiler sector
// Runs daily 7am ET. Surfaces 3 signal types:
//   1. MIOSHA Compliance Gap (expired/expiring boiler operator licenses)
//   2. Municipal Bond Funding (facility bonds that need boiler work)
//   3. Expansion Hiring (companies hiring boiler/stationary engineers)
// Writes to industry_pulse_signals table, SMS alerts sector clients.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SECTOR = "boiler";

// Sector clients — add more as the product grows
const SECTOR_CLIENTS = [
  { client_tag: "dj-conley", phone: "+13135904404", name: "DJ Conley Associates" },
];

const METRO_DETROIT_SCOPE = "Metro Detroit Michigan Wayne Oakland Macomb county";

const TARGET_INDUSTRIES = [
  "hospital", "health system", "medical center", "nursing facility",
  "school district", "university", "college campus",
  "brewery", "meat processing", "dairy", "food processing",
  "automotive supplier", "chemical plant", "manufacturing",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractJSON(raw: string): string {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : cleaned.trim();
}

async function aiChat(prompt: string, maxTokens = 1500): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error(`[AI] ${res.status}`); return ""; }
    const d = await res.json();
    return d?.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) { console.error("[AI]", e); return ""; }
}

async function sonarSearch(query: string): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 2000,
        messages: [{ role: "user", content: query }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d?.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

interface Signal {
  company_name: string;
  location: string;
  signal_type: "compliance_gap" | "funding_secured" | "expansion_hiring";
  confidence: number;
  recommended_pitch: string;
  source_urls: string[];
  industry?: string;
}

// ─── SIGNAL 1: MIOSHA COMPLIANCE GAP ───
async function scanComplianceGaps(sb: any): Promise<Signal[]> {
  console.log("[boiler-intel] Scanning compliance gaps...");
  const signals: Signal[] = [];

  const { data: candidates, error } = await sb
    .from("hire_alert_candidates")
    .select("full_name, name, current_employer, license_type, city, license_expiry, availability_score")
    .or("license_type.ilike.%boiler%,license_type.ilike.%stationary engineer%,license_type.ilike.%1st class%,license_type.ilike.%second class%")
    .not("current_employer", "is", null)
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  if (error) { console.error("[compliance] DB error:", error.message); return []; }
  if (!candidates?.length) { console.log("[compliance] No candidates found"); return []; }

  for (const c of candidates) {
    const employer = c.current_employer || "";
    const isTarget = TARGET_INDUSTRIES.some(t => employer.toLowerCase().includes(t));
    if (!isTarget) continue;

    // Check if license is expired or expiring
    let isExpired = false;
    let isExpiring = false;
    if (c.license_expiry) {
      try {
        const expDate = new Date(c.license_expiry);
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 86400000);
        isExpired = expDate < now;
        isExpiring = !isExpired && expDate < thirtyDays;
      } catch { /* text field, may not parse */ }
    }

    if (!isExpired && !isExpiring) continue;

    const personName = c.full_name || c.name || "Unknown";
    const city = c.city || "Metro Detroit";
    const confidence = isExpired ? 9 : 7;

    signals.push({
      company_name: employer,
      location: `${city}, MI`,
      signal_type: "compliance_gap",
      confidence,
      recommended_pitch: `COMPLIANCE ALERT: ${employer} in ${city} just lost their licensed boiler operator (${personName}, license: ${c.license_type || "Boiler"}). They are out of MIOSHA compliance. Call Director of Facilities immediately — pitch preventative maintenance contract to cover their boilers while they recruit. This is an urgent inbound opportunity.`,
      source_urls: ["https://miosha.michigan.gov"],
      industry: "boiler_operations",
    });
  }

  console.log(`[compliance] Found ${signals.length} compliance gap signals`);
  return signals;
}

// ─── SIGNAL 2: MUNICIPAL BOND FUNDING ───
async function scanBondFunding(): Promise<Signal[]> {
  console.log("[boiler-intel] Scanning bond funding...");
  const signals: Signal[] = [];

  const raw = await sonarSearch(
    `Search for recent news from the past 90 days about municipal bonds, facility bonds, or millage approvals in Metro Detroit, Wayne County, Oakland County, Macomb County, or Washtenaw County Michigan.

Focus on:
- School districts approving facility bonds
- Hospitals or health systems with capital improvement bonds
- Universities with infrastructure bonds
- Any organization with bonds mentioning HVAC, boiler, mechanical, energy, facility upgrade, or infrastructure

Search sources: mlive.com, crainsdetroit.com, detroitnews.com, freep.com, michigan.gov

Return ONLY a JSON array (no markdown, no explanation):
[{
  "organization_name": "...",
  "bond_amount": "$XX million",
  "purpose": "facility upgrades including...",
  "city": "City, MI",
  "source_url": "https://..." or null
}]
If none found, return: []`
  );

  let bonds: any[] = [];
  try { bonds = JSON.parse(extractJSON(raw)); if (!Array.isArray(bonds)) bonds = []; } catch { bonds = []; }

  for (const bond of bonds) {
    if (!bond.organization_name) continue;

    // Use Gemini to assess boiler relevance
    const assessment = await aiChat(
      `A Michigan organization "${bond.organization_name}" just approved a ${bond.bond_amount || "facility"} bond for: "${bond.purpose || "facility improvements"}".

On a scale of 1-10, how likely is it this project will need industrial boiler equipment or HVAC mechanical work? Consider: hospitals always have boilers, schools have boilers for heating, universities have central plants, food processing needs steam.

Return ONLY JSON: {"confidence_needs_boilers": N, "suggested_contact_title": "Director of Facilities"}`
    );

    let conf = 6;
    let contactTitle = "Director of Facilities";
    try {
      const p = JSON.parse(extractJSON(assessment));
      conf = p.confidence_needs_boilers || 6;
      contactTitle = p.suggested_contact_title || "Director of Facilities";
    } catch { /* use defaults */ }

    if (conf < 6) continue;

    signals.push({
      company_name: bond.organization_name,
      location: bond.city || "Metro Detroit, MI",
      signal_type: "funding_secured",
      confidence: conf,
      recommended_pitch: `${bond.organization_name} just approved a ${bond.bond_amount || "facility"} bond. They have capital allocated TODAY before vendor relationships are formed. Contact ${contactTitle} to pitch high-efficiency boiler upgrades before the spec is written. First vendor in owns the project.`,
      source_urls: bond.source_url ? [bond.source_url] : [],
      industry: "municipal_infrastructure",
    });
  }

  console.log(`[funding] Found ${signals.length} bond funding signals`);
  return signals;
}

// ─── SIGNAL 3: EXPANSION HIRING ───
async function scanExpansionHiring(): Promise<Signal[]> {
  console.log("[boiler-intel] Scanning expansion hiring...");
  const signals: Signal[] = [];

  const raw = await sonarSearch(
    `Search for recent job postings and hiring news in the past 30 days for these roles in Michigan, especially Metro Detroit:
- Stationary Engineer
- Boiler Operator
- Chief Stationary Engineer
- Facilities Engineer
- Plant Engineer
- Maintenance Supervisor at breweries, food processing, meat processing, dairy, automotive, chemical plants

Look at Indeed, LinkedIn, and company career pages.

Also search for companies hiring multiple maintenance or facilities positions, which indicates expansion.

Return ONLY a JSON array (no markdown):
[{
  "company_name": "...",
  "industry": "...",
  "jobs_count": N,
  "city": "City, MI",
  "is_expansion_signal": true/false,
  "confidence": N (1-10),
  "source_url": "https://..." or null
}]
If none found, return: []`
  );

  let hires: any[] = [];
  try { hires = JSON.parse(extractJSON(raw)); if (!Array.isArray(hires)) hires = []; } catch { hires = []; }

  for (const h of hires) {
    if (!h.company_name || !h.is_expansion_signal || (h.confidence || 0) < 6) continue;

    signals.push({
      company_name: h.company_name,
      location: h.city || "Metro Detroit, MI",
      signal_type: "expansion_hiring",
      confidence: h.confidence || 7,
      recommended_pitch: `${h.company_name} in ${h.city || "Michigan"} is hiring ${h.jobs_count || "multiple"} stationary engineers / boiler operators. This volume indicates a new production line or major capacity expansion — not routine backfill. Call the Plant Manager now to quote new industrial boiler equipment before they spec with a competitor. Reference their job posting as your opener.`,
      source_urls: h.source_url ? [h.source_url] : [],
      industry: h.industry || "industrial",
    });
  }

  console.log(`[hiring] Found ${signals.length} expansion hiring signals`);
  return signals;
}

// ─── DEDUPLICATION + INSERT ───
async function dedupeAndInsert(sb: any, signals: Signal[]): Promise<Signal[]> {
  const inserted: Signal[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  for (const s of signals) {
    // Check for duplicate within 7 days
    const { data: existing } = await sb
      .from("industry_pulse_signals")
      .select("id")
      .eq("company_name", s.company_name)
      .eq("signal_type", s.signal_type)
      .gte("detected_at", sevenDaysAgo)
      .limit(1);

    if (existing?.length) continue;

    const { error } = await sb.from("industry_pulse_signals").insert({
      company_name: s.company_name,
      location: s.location,
      signal_type: s.signal_type,
      sector: SECTOR,
      confidence: s.confidence,
      recommended_pitch: s.recommended_pitch,
      source_urls: s.source_urls,
      industry: s.industry,
      detected_at: new Date().toISOString(),
    });

    if (error) { console.error(`[insert] ${s.company_name}:`, error.message); }
    else { inserted.push(s); }
  }

  return inserted;
}

// ─── SMS ALERTS ───
async function sendAlerts(inserted: Signal[]) {
  if (!inserted.length || !TWILIO_PHONE) return;

  const emojis: Record<string, string> = {
    compliance_gap: "🚨",
    funding_secured: "💰",
    expansion_hiring: "📈",
  };

  // Max 3 SMS per client per run
  for (const client of SECTOR_CLIENTS) {
    const toSend = inserted.slice(0, 3);
    for (const s of toSend) {
      const emoji = emojis[s.signal_type] || "⚡";
      const pitchTrunc = s.recommended_pitch.slice(0, 200);
      const body = `⚡ DWA SALES INTEL ${emoji}\n${s.company_name} — ${s.location}\n${pitchTrunc}\nConfidence: ${s.confidence}/10`;

      await sendSMS(client.phone, TWILIO_PHONE, body, "boiler_sector_intel");
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Run all 3 signal scans in parallel
    const [complianceResult, fundingResult, hiringResult] = await Promise.allSettled([
      scanComplianceGaps(sb),
      scanBondFunding(),
      scanExpansionHiring(),
    ]);

    const allSignals: Signal[] = [
      ...(complianceResult.status === "fulfilled" ? complianceResult.value : []),
      ...(fundingResult.status === "fulfilled" ? fundingResult.value : []),
      ...(hiringResult.status === "fulfilled" ? hiringResult.value : []),
    ];

    // Log any failures
    if (complianceResult.status === "rejected") console.error("[compliance] Failed:", complianceResult.reason);
    if (fundingResult.status === "rejected") console.error("[funding] Failed:", fundingResult.reason);
    if (hiringResult.status === "rejected") console.error("[hiring] Failed:", hiringResult.reason);

    console.log(`[boiler-intel] Total raw signals: ${allSignals.length}`);

    // Dedupe and insert
    const inserted = await dedupeAndInsert(sb, allSignals);
    console.log(`[boiler-intel] Inserted ${inserted.length} new signals`);

    // Send SMS alerts
    await sendAlerts(inserted);

    return new Response(JSON.stringify({
      sector: SECTOR,
      signals_found: allSignals.length,
      signals_inserted: inserted.length,
      breakdown: {
        compliance_gap: allSignals.filter(s => s.signal_type === "compliance_gap").length,
        funding_secured: allSignals.filter(s => s.signal_type === "funding_secured").length,
        expansion_hiring: allSignals.filter(s => s.signal_type === "expansion_hiring").length,
      },
      scanned_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[boiler-intel] Fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
