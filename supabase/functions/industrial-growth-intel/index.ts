// industrial-growth-intel — Sonar-powered Metro Detroit expansion scanner
// Now multi-vertical: scans for expansion signals across steel, plumbing supply,
// roofing supply, HVAC, electrical, concrete, lumber, and general industrial.
// Cron-gated: skips Sonar call if no active subscribers (saves credits).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function extractJSON(raw: string): string {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : cleaned.trim();
}

interface VerticalConfig {
  label: string;
  prompt: string;
  buyer_type: string;
}

const VERTICAL_PROMPTS: Record<string, VerticalConfig> = {
  industrial_general: {
    label: "Industrial / Manufacturing Expansion",
    buyer_type: "recruiter",
    prompt: `Search for recent news (past 90 days) about Metro Detroit manufacturing/industrial activity. Find companies that are expanding facilities, acquiring CNC/industrial machinery, awarded large commercial contracts, hiring skilled trades, or receiving government contracts requiring workforce expansion. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  steel: {
    label: "Steel Service / Fabrication Demand",
    buyer_type: "supplier",
    prompt: `Search for recent news (past 90 days) about Metro Detroit manufacturers and fabrication shops that just won new contracts, announced equipment expansions, installed new CNC or press equipment, broke ground on new fabrication facilities, or posted multiple CNC/welder/fabricator job openings. These signal upcoming raw steel orders within 30-60 days. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  plumbing_supply: {
    label: "Plumbing Supply Demand",
    buyer_type: "supplier",
    prompt: `Search for recent commercial construction permits and project announcements in Metro Detroit (past 60 days) requiring plumbing rough-in: new restaurants, medical buildouts, multi-family residential projects, hotel construction. These signal upcoming PEX/copper/fixture orders within 45 days. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  roofing_supply: {
    label: "Roofing Supply Demand",
    buyer_type: "supplier",
    prompt: `Search for recent (past 60 days) Metro Detroit storm damage events, hail reports, insurance claim spikes, and roofing contractors posting hiring ads. These signal urgent shingle/underlayment orders within 7-14 days. Include any commercial roof replacement permits filed. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  hvac_supply: {
    label: "HVAC Wholesale Demand",
    buyer_type: "supplier",
    prompt: `Search for recent (past 60 days) Metro Detroit commercial mechanical permits, new boiler installations, HVAC contractors awarded large commercial jobs, and properties with expiring boiler operator licenses (likely facing equipment service needs). Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  electrical_supply: {
    label: "Electrical Supply Demand",
    buyer_type: "supplier",
    prompt: `Search for recent (past 60 days) Metro Detroit solar permit filings, EV charger installations, commercial electrical permit pulls, and large electrical contracts. These signal upcoming panel/conduit/wire orders. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  concrete: {
    label: "Concrete / Aggregate Demand",
    buyer_type: "supplier",
    prompt: `Search for recent (past 60 days) Metro Detroit foundation permit filings, large commercial site preparation announcements, and ready-mix concrete demand signals. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
  lumber: {
    label: "Lumber / Framing Demand",
    buyer_type: "supplier",
    prompt: `Search for recent (past 60 days) Metro Detroit single-family home permit pulls and framing package orders. Aggregate by city. Focus on Wayne, Oakland, Macomb, and Washtenaw counties.`,
  },
};

async function runVerticalScan(vertical: string, config: VerticalConfig) {
  const prompt = `${config.prompt}

Return ONLY a JSON array (no markdown, no explanation) of up to 12 results:
[
  {
    "company_name": "Company Name",
    "location": "City, MI",
    "county": "Wayne | Oakland | Macomb | Washtenaw",
    "expansion_type": "New Plant | Equipment Acquisition | Contract Award | Workforce Expansion | Permit Filing | Storm Event | Facility Upgrade",
    "details": "Brief description with specifics",
    "predicted_needs": ["item 1", "item 2"],
    "confidence": 7,
    "news_date": "2026-04-01" or null,
    "source_url": "https://..." or null
  }
]
Confidence is 1-10. Score 8+ only if you have strong corroborating evidence (multiple sources or specific dollar amounts). If no results found, return: []`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "perplexity/sonar-pro",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sonar ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "[]";
  const jsonStr = extractJSON(raw);
  let leads: any[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    leads = Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error(`[industrial-growth-intel:${vertical}] JSON parse failed`);
    return [];
  }

  return leads.map((l) => ({ ...l, vertical, target_buyer_type: config.buyer_type }));
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const verticalParam: string = body.vertical || "industrial_general";
  const persist: boolean = body.persist === true;
  const isCron: boolean = body.trigger === "cron";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Cron gate: skip Sonar if no active subscribers
  if (isCron) {
    const { count } = await supabase
      .from("industry_pulse_clients")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (!count || count === 0) {
      await supabase.from("system_comms_log").insert({
        channel: "system", product: "industrial-growth-intel",
        recipient: "cron", body_preview: "skipped — no active subscribers",
        status: "skipped",
      });
      return new Response(JSON.stringify({ skipped: true, reason: "no active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Determine which verticals to scan
  let verticalsToScan: string[];
  if (verticalParam === "all" || isCron) {
    // Cron scans all verticals where active subscribers exist
    const { data: clients } = await supabase
      .from("industry_pulse_clients")
      .select("vertical")
      .eq("active", true);
    const subscribed = new Set((clients || []).map((c: any) => c.vertical).filter(Boolean));
    verticalsToScan = subscribed.size > 0
      ? Array.from(subscribed).filter((v) => VERTICAL_PROMPTS[v as string]) as string[]
      : ["industrial_general"]; // fallback
    if (verticalsToScan.length === 0) verticalsToScan = ["industrial_general"];
  } else {
    if (!VERTICAL_PROMPTS[verticalParam]) {
      return new Response(JSON.stringify({ error: `Unknown vertical: ${verticalParam}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    verticalsToScan = [verticalParam];
  }

  const allLeads: any[] = [];
  const errors: string[] = [];

  for (const v of verticalsToScan) {
    try {
      const leads = await runVerticalScan(v, VERTICAL_PROMPTS[v]);
      allLeads.push(...leads);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[industrial-growth-intel] ${v} failed: ${msg}`);
      errors.push(`${v}: ${msg}`);
    }
  }

  // Sort by confidence + date
  allLeads.sort((a, b) => {
    const ac = a.confidence || 0, bc = b.confidence || 0;
    if (bc !== ac) return bc - ac;
    if (!a.news_date && !b.news_date) return 0;
    if (!a.news_date) return 1;
    if (!b.news_date) return -1;
    return b.news_date.localeCompare(a.news_date);
  });

  let inserted = 0;
  if (persist && allLeads.length) {
    for (const lead of allLeads) {
      try {
        const { error } = await supabase.from("industry_pulse_signals").insert({
          company_name: lead.company_name,
          location: lead.location,
          county: lead.county,
          industry: lead.vertical,
          vertical: lead.vertical,
          target_buyer_type: lead.target_buyer_type,
          expansion_type: lead.expansion_type,
          predicted_needs: lead.predicted_needs || [],
          confidence: Math.max(1, Math.min(10, lead.confidence || 5)),
          source_urls: lead.source_url ? [lead.source_url] : [],
          recommended_pitch: lead.details,
          detected_at: lead.news_date ? `${lead.news_date}T12:00:00Z` : new Date().toISOString(),
          signal_type: "expansion",
          sector: lead.vertical,
        });
        if (!error) inserted++;
      } catch {}
    }
  }

  return new Response(JSON.stringify({
    leads: allLeads,
    total: allLeads.length,
    inserted,
    verticals_scanned: verticalsToScan,
    errors,
    scanned_at: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
