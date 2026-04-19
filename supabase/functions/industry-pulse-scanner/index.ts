// industry-pulse-scanner — Predictive demand intelligence engine
// Scans Metro Detroit hiring patterns and predicts equipment/service needs.
// Uses Sonar (Perplexity) for hiring signal harvesting + Lovable AI Gateway for prediction.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

// ── Apollo org validation (item 21) ──────────────────────────────────────────
async function apolloValidateCompany(name: string): Promise<{ valid: boolean; employee_count: number | null; size_tier: string }> {
  if (!APOLLO_API_KEY) return { valid: true, employee_count: null, size_tier: "unknown" };
  try {
    const res = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?organization_name=${encodeURIComponent(name)}`, {
      headers: { "X-Api-Key": APOLLO_API_KEY },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { valid: true, employee_count: null, size_tier: "unknown" };
    const data = await res.json();
    const emp = data?.organization?.estimated_num_employees;
    const tier = !emp ? "unknown" : emp <= 10 ? "micro" : emp <= 50 ? "small" : emp <= 200 ? "mid" : "large";
    return { valid: !!data?.organization, employee_count: emp ?? null, size_tier: tier };
  } catch {
    return { valid: true, employee_count: null, size_tier: "unknown" };
  }
}

// ── Detroit BSEED permit surge harvester (item 19) ───────────────────────────
async function harvestBSEEDPermitSignals(sb: any): Promise<any[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    // Detroit BSEED ArcGIS REST endpoint for commercial permits
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth()+1).padStart(2,"0")}-${String(thirtyDaysAgo.getDate()).padStart(2,"0")}`;

    // Try ArcGIS first; fall back to Sonar web search
    let permitData: any[] = [];
    try {
      const arcRes = await fetch(
        `https://gis.detroitmi.gov/arcgis/rest/services/DBI/OpenDataPortal/FeatureServer/0/query?where=permit_issued+>=+date+'${dateStr}'+AND+estimated_cost+>=+50000+AND+permit_type+LIKE+'%25COMMERCIAL%25'&outFields=contractor_name,permit_type,estimated_cost,address,permit_issued&f=json&resultRecordCount=100`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        permitData = (arcData?.features || []).map((f: any) => f.attributes).filter((a: any) => a.contractor_name);
      }
    } catch { /* fall through to Sonar */ }

    if (!permitData.length) {
      // Sonar fallback: search recent BSEED permit filings
      const sonarRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [{ role: "user", content: `Search for recent building permits filed in Detroit Michigan in the last 30 days worth over $50,000: site:detroitmi.gov permits OR BSEED building permit 2025 commercial contractor

Extract: contractor company name, permit type, estimated value, address.
Return JSON array: [{"contractor_name":"...","permit_type":"...","estimated_cost":50000,"address":"..."}]
Return empty array [] if nothing found.` }],
          max_tokens: 800, temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (sonarRes.ok) {
        const sonarData = await sonarRes.json();
        const raw = sonarData?.choices?.[0]?.message?.content || "";
        try { permitData = extractJSON(raw) || []; } catch { permitData = []; }
      }
    }

    if (!permitData.length) return [];

    // Aggregate by contractor name (item 22 — multi-permit aggregation)
    const aggregated: Record<string, { contractor: string; count: number; total_value: number; types: string[] }> = {};
    for (const p of permitData) {
      const key = (p.contractor_name || "").toLowerCase().trim();
      if (!key || key.length < 3) continue;
      if (!aggregated[key]) aggregated[key] = { contractor: p.contractor_name, count: 0, total_value: 0, types: [] };
      aggregated[key].count++;
      aggregated[key].total_value += Number(p.estimated_cost) || 0;
      if (p.permit_type && !aggregated[key].types.includes(p.permit_type)) aggregated[key].types.push(p.permit_type);
    }

    // Only emit companies with 3+ permits (high-volume buyer signal)
    const hvbSignals: any[] = [];
    for (const agg of Object.values(aggregated)) {
      if (agg.count < 3) continue;
      const avgValue = Math.round(agg.total_value / agg.count);
      hvbSignals.push({
        company_name: agg.contractor,
        location: "Detroit, MI",
        industry: "Commercial Construction",
        hiring_roles: agg.types,
        hiring_count: agg.count,
        predicted_needs: ["Building materials", "HVAC equipment", "Electrical supplies", "Plumbing fixtures"],
        confidence: Math.min(10, 6 + Math.floor(agg.count / 2)),
        recommended_pitch: `⚡ HIGH-VOLUME BUYER: ${agg.contractor} has pulled ${agg.count} commercial permits in the last 30 days (avg $${avgValue.toLocaleString()}/permit). Active project pipeline — ideal for supply house outreach.`,
        source_urls: [],
        cross_referenced: false,
        signal_type: "permit_surge",
        sector: "construction",
      });
    }
    console.log(`[industry-pulse] BSEED: ${permitData.length} permits → ${hvbSignals.length} high-volume buyer signals`);
    return hvbSignals;
  } catch (e) {
    console.warn("[industry-pulse] BSEED harvest error:", e instanceof Error ? e.message : String(e));
    return [];
  }
}



const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trade categories to scan
const TRADE_QUERIES = [
  { industry: "HVAC", query: '"hiring" "HVAC technician" OR "HVAC installer" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "CNC/Machining", query: '"hiring" "CNC machinist" OR "CNC operator" OR "CNC programmer" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Welding", query: '"hiring" "welder" OR "welding" OR "fabricator" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Electrical", query: '"hiring" "electrician" OR "electrical" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Boiler/Pressure", query: '"hiring" "boiler operator" OR "boiler technician" OR "pressure vessel" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
  { industry: "Plumbing", query: '"hiring" "plumber" OR "plumbing" site:indeed.com OR site:ziprecruiter.com "Detroit" OR "Michigan" 2026' },
];

// Hardcoded fallback mappings
const FALLBACK_MAPPINGS: Record<string, string[]> = {
  "HVAC": ["Refrigerant", "Ductwork", "Recovery equipment", "HVAC tools", "Sheet metal"],
  "CNC/Machining": ["Tooling", "Coolant", "Fixturing", "New CNC machines", "Metrology equipment"],
  "Welding": ["Welding gas", "Rod/wire", "PPE", "Fume extraction", "Welding machines"],
  "Electrical": ["Panel upgrades", "Conduit", "Testing equipment", "Wire/cable", "Transformers"],
  "Boiler/Pressure": ["Boiler parts", "Maintenance contracts", "Safety inspection services", "Pressure gauges", "Water treatment"],
  "Plumbing": ["Pipe fittings", "Water heaters", "Drain equipment", "Backflow preventers", "PEX supplies"],
};

function extractJSON(raw: string): any {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  return JSON.parse(cleaned);
}

async function harvestHiringSignals(query: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "user",
            content: `Search the web for recent hiring activity: ${query}

For each company you find hiring, extract:
- Company name
- Location (city, state)
- Roles they're hiring for
- Approximate number of positions (if visible)
- Source URL

Return ONLY valid JSON array:
[{"company":"...","location":"...","roles":["..."],"count":1,"source_url":"..."}]

If no results found, return empty array: []`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return "";
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

async function predictNeeds(company: string, roles: string[], count: number, industry: string): Promise<{ predicted_needs: string[]; confidence: number; recommended_pitch: string }> {
  // Fallback
  const fallback = {
    predicted_needs: FALLBACK_MAPPINGS[industry] || ["Equipment", "Maintenance contracts"],
    confidence: 4,
    recommended_pitch: `${company} is hiring ${count}+ ${roles.join("/")} — likely expanding operations. Reach out with ${industry} equipment/service proposals.`,
  };

  if (!LOVABLE_API_KEY) return fallback;

  try {
    const prompt = `A company called "${company}" is hiring ${count} people for these roles: ${roles.join(", ")}. Industry: ${industry}.

Based on these hiring patterns, predict:
1. What capital equipment, supplies, or service contracts will they likely need in the next 90 days?
2. How confident are you? (1-10 scale, where 10 = certain purchase, 1 = speculative)
3. Write a 2-sentence recommended pitch angle for a salesperson selling to this company.

Rules:
- Multiple trades hiring at once = facility expansion = highest confidence (8-10)
- Single trade = normal replacement = lower confidence (3-5)
- 3+ same trade = growth/new contracts = medium-high confidence (6-8)

Return ONLY valid JSON:
{"predicted_needs":["..."],"confidence":7,"recommended_pitch":"..."}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(raw);
    return {
      predicted_needs: parsed.predicted_needs || fallback.predicted_needs,
      confidence: Math.min(10, Math.max(1, parsed.confidence || 4)),
      recommended_pitch: parsed.recommended_pitch || fallback.recommended_pitch,
    };
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const signals: any[] = [];
    let totalScanned = 0;

    // Scan each trade category
    for (const trade of TRADE_QUERIES) {
      console.log(`[industry-pulse] Scanning ${trade.industry}...`);
      const raw = await harvestHiringSignals(trade.query);
      if (!raw) continue;

      try {
        const companies = extractJSON(raw);
        if (!Array.isArray(companies)) continue;
        totalScanned += companies.length;

        for (const co of companies.slice(0, 5)) {
          if (!co.company || !co.roles?.length) continue;

          // Filter out job board names and aggregator junk
          const junkNames = ["indeed", "ziprecruiter", "linkedin", "multiple employers", "various", "confidential", "staffing agency", "temp agency"];
          if (junkNames.some(j => co.company.toLowerCase().includes(j))) continue;
          if (co.company.length < 3 || co.company.length > 100) continue;

          const prediction = await predictNeeds(
            co.company,
            co.roles,
            co.count || 1,
            trade.industry
          );

          // Item 21: Apollo org validation — skip junk companies, get size_tier
          const apolloCheck = await apolloValidateCompany(co.company);
          if (!apolloCheck.valid) continue;
          // Boost confidence for small companies (growing fast = hot prospect)
          let adjConfidence = prediction.confidence;
          if (apolloCheck.size_tier === "micro") adjConfidence = Math.min(10, adjConfidence + 1);

          signals.push({
            company_name: co.company,
            location: co.location || "Metro Detroit, MI",
            industry: trade.industry,
            hiring_roles: co.roles,
            hiring_count: co.count || 1,
            predicted_needs: prediction.predicted_needs,
            confidence: adjConfidence,
            recommended_pitch: prediction.recommended_pitch,
            source_urls: co.source_url ? [co.source_url] : [],
            cross_referenced: false,
            sector: apolloCheck.size_tier !== "unknown" ? apolloCheck.size_tier : null,
          });
        }
      } catch {
        console.log(`[industry-pulse] Failed to parse ${trade.industry} results`);
      }
    }

    // Item 19: Harvest BSEED permit surge signals (aggregated by contractor, item 22)
    const bseedSignals = await harvestBSEEDPermitSignals(sb);
    signals.push(...bseedSignals);

    // Cross-reference: check if any companies also appear in industrial growth intel
    if (signals.length > 0) {
      const companyNames = signals.map((s) => s.company_name.toLowerCase());

      // Check existing expansion news signals
      const { data: existingNews } = await sb
        .from("industry_pulse_signals")
        .select("company_name")
        .eq("cross_referenced", false)
        .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const existingCompanies = new Set((existingNews || []).map((n: any) => n.company_name.toLowerCase()));

      for (const signal of signals) {
        if (existingCompanies.has(signal.company_name.toLowerCase())) {
          signal.cross_referenced = true;
          signal.confidence = Math.min(10, signal.confidence + 2);
          signal.recommended_pitch = `⚡ HIGH CONFIDENCE: ${signal.company_name} appears in BOTH hiring AND expansion news. ${signal.recommended_pitch}`;
        }
      }
    }

    // Deduplicate: skip any company+industry seen in the last 7 days
    if (signals.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSignals } = await sb
        .from("industry_pulse_signals")
        .select("company_name, industry")
        .gte("detected_at", sevenDaysAgo);

      const recentKeys = new Set(
        (recentSignals || []).map((r: any) => `${r.company_name.toLowerCase()}|${(r.industry || "").toLowerCase()}`)
      );

      const deduped = signals.filter((s) =>
        !recentKeys.has(`${s.company_name.toLowerCase()}|${(s.industry || "").toLowerCase()}`)
      );

      if (deduped.length > 0) {
        const { error: insertErr } = await sb
          .from("industry_pulse_signals")
          .insert(deduped);
        if (insertErr) console.error("[industry-pulse] Insert error:", insertErr);
      }
      console.log(`[industry-pulse] Deduped: ${signals.length} found, ${deduped.length} new`);
    }

    // Update agent heartbeat
    await sb
      .from("agent_heartbeats")
      .upsert(
        { agent_name: "industry-pulse-scanner", last_beat: new Date().toISOString(), metadata: { signals_found: signals.length, total_scanned: totalScanned } },
        { onConflict: "agent_name" }
      );

    // Notify Matt if high-confidence signals found
    const highConf = signals.filter((s) => s.confidence >= 7);
    if (highConf.length > 0 && RESEND_API_KEY) {
      const rows = highConf.map((s) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#fff;font-weight:bold">${s.company_name}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8">${s.hiring_roles.join(", ")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#00d4ff;font-weight:bold">${s.confidence}/10${s.cross_referenced ? " ⚡" : ""}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:#94a3b8">${s.predicted_needs.slice(0, 3).join(", ")}</td>
        </tr>
      `).join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          subject: `🔮 Industry Pulse: ${highConf.length} high-confidence signals detected`,
          html: `
            <div style="background:#0a1628;padding:24px;font-family:system-ui">
              <h2 style="color:#00d4ff;margin:0 0 16px">🔮 Industry Pulse Report</h2>
              <p style="color:#94a3b8;margin:0 0 16px">${signals.length} total signals · ${highConf.length} high confidence · ${signals.filter(s => s.cross_referenced).length} cross-referenced</p>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">COMPANY</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">HIRING</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">CONFIDENCE</th>
                  <th style="text-align:left;padding:8px;border-bottom:2px solid #1e293b;color:#64748b;font-size:11px">PREDICTED NEEDS</th>
                </tr>
                ${rows}
              </table>
              <p style="color:#475569;font-size:11px;margin:16px 0 0">View full details in DWA Admin → Growth Signals</p>
            </div>
          `,
        }),
      });
    }

    console.log(`[industry-pulse] Complete: ${signals.length} signals, ${highConf.length} high-confidence`);

    return new Response(JSON.stringify({
      success: true,
      signals_found: signals.length,
      high_confidence: highConf.length,
      cross_referenced: signals.filter((s) => s.cross_referenced).length,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[industry-pulse-scanner]", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
