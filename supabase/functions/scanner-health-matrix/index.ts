// Phase 4 — Scanner & Waterfall Quality Audit
// Returns a green/yellow/red matrix per data source per product scanner.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { probeAll, type ProbeResult } from "../_shared/source-probes.ts";
import { breakerStatus } from "../_shared/circuit-breaker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product → scanner agent name + key data sources to verify last-success on
const PRODUCT_SCANNERS: Record<string, { agents: string[]; sources: string[]; tables: { table: string; tsCol: string }[] }> = {
  "Mortgage Radar": {
    agents: ["mortgage-radar-scanner", "mortgage-radar-am-digest"],
    sources: ["BSEED permits", "EstateSales", "LARA LLCs", "Wayne County deeds", "Oakland County permits", "CourtListener Ch.13", "Realtor.com FSBO", "Address Validation"],
    tables: [{ table: "mortgage_radar_leads", tsCol: "created_at" }],
  },
  "Trade Radar (11 verticals)": {
    agents: ["trade-radar-scanner", "trade-radar-am-digest"],
    sources: ["BSEED ArcGIS", "DLBA", "SPC storms", "NOAA CDO", "FEMA disasters", "Detroit 311", "Census ACS", "Drought Monitor", "USGS streamflow", "Wayne County GIS", "Oakland County GIS", "Fire Incidents", "CofC expirations"],
    tables: [{ table: "trade_radar_leads", tsCol: "created_at" }, { table: "trade_radar_area_signals", tsCol: "created_at" }],
  },
  "TechAlert": {
    agents: ["techalert-prospect-hunter", "techalert-enrich", "techalert-outreach", "techalert-followup-drip"],
    sources: ["Sonar job boards", "GitHub", "SEC EDGAR", "USPTO", "SAM.gov", "BLS", "Eventbrite", "USASpending", "LinkedIn", "OSHA DOL", "LARA", "NLRB", "CFPB", "CourtListener Ch.7", "Detroit certified", "City contracts"],
    tables: [{ table: "hire_alert_candidates", tsCol: "created_at" }],
  },
  "Contractor Marketplace": {
    agents: ["channel-prospector", "channel-prospector-followup", "marketplace-outreach-blast"],
    sources: ["Google Places", "DataForSEO Local Pack", "Apollo enrichment", "Hunter", "Firecrawl"],
    tables: [{ table: "marketplace_prospects", tsCol: "created_at" }],
  },
  "SiteRadar": {
    agents: ["visitor-identify", "site-radar-repeat-alert", "site-radar-weekly-digest"],
    sources: ["ipinfo.io", "Clearbit Reveal"],
    tables: [{ table: "crm_visitor_events", tsCol: "created_at" }],
  },
  "Dead Lead Reactivation": {
    agents: ["dead-lead-drip"],
    sources: ["OpenRouter Sonar", "Twilio Lookup"],
    tables: [{ table: "dead_lead_contacts", tsCol: "created_at" }],
  },
};

function statusFor(hoursSince: number | null): "green" | "yellow" | "red" {
  if (hoursSince === null) return "red";
  if (hoursSince <= 26) return "green";
  if (hoursSince <= 24 * 7) return "yellow";
  return "red";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const products = [];
  for (const [product, cfg] of Object.entries(PRODUCT_SCANNERS)) {
    // Agent heartbeats
    const { data: heartbeats } = await sb
      .from("agent_heartbeats")
      .select("agent_name, last_beat, status")
      .in("agent_name", cfg.agents);

    const agents = cfg.agents.map((name) => {
      const hb = heartbeats?.find((h: any) => h.agent_name === name);
      const hoursSince = hb ? (Date.now() - new Date(hb.last_beat).getTime()) / 3.6e6 : null;
      return {
        name,
        last_beat: hb?.last_beat || null,
        hours_since: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
        status: statusFor(hoursSince),
      };
    });

    // Latest row per data table (proves writes are flowing)
    const tables = await Promise.all(cfg.tables.map(async ({ table, tsCol }) => {
      const { data, error } = await sb.from(table as any).select(tsCol).order(tsCol, { ascending: false }).limit(1);
      if (error) return { table, last_row: null, hours_since: null, status: "red" as const, error: error.message };
      const last = (data?.[0] as any)?.[tsCol] || null;
      const hoursSince = last ? (Date.now() - new Date(last).getTime()) / 3.6e6 : null;
      return {
        table,
        last_row: last,
        hours_since: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
        status: statusFor(hoursSince),
      };
    }));

    // Roll up product status from worst agent + worst table
    const allStatuses = [...agents.map((a) => a.status), ...tables.map((t) => t.status)];
    const overall: "green" | "yellow" | "red" = allStatuses.includes("red")
      ? "red"
      : allStatuses.includes("yellow")
        ? "yellow"
        : "green";

    products.push({
      product,
      overall,
      agents,
      tables,
      sources: cfg.sources, // declarative for now; future = ping each
    });
  }

  return new Response(JSON.stringify({ ok: true, generated_at: new Date().toISOString(), products }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
