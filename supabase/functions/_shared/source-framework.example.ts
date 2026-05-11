// Example usage of the source framework. Not wired anywhere — reference only.
//
// To author a real source:
//   1. Copy this file pattern into _shared/scanner-extras-*.ts (or a new dispatcher).
//   2. Call runSources(sb, [...defs]) from your scanner edge function.
//   3. (Optional) Add a row to `scanner_source_mappings` for explicit field mapping.
//      Otherwise the canonical-mapper heuristic kicks in.

import { defineSource } from "./source-framework.ts";

// Tier-S #6 — NWS Watches/Warnings (no auth, polygon-level weather alerts).
export const nwsActiveAlerts = defineSource({
  slug: "nws_active_alerts",
  product: "trade_radar",
  host: "api.weather.gov",
  rps: 2,
  fetch: async (ctx) => {
    return await ctx.fetchJson<{ features: unknown[] }>(
      "https://api.weather.gov/alerts/active?area=MI",
      { headers: { "User-Agent": "DWA Scanner (matt@detroitwebagent.com)" } },
    );
  },
  extractRows: (payload) => (payload?.features ?? []) as Record<string, unknown>[],
  normalize: (feature) => {
    const p = (feature as { properties?: Record<string, unknown> }).properties ?? {};
    return {
      external_id: p.id ?? p.identifier,
      title: p.event,
      description: p.headline,
      occurred_at: p.sent ?? p.effective,
      area: p.areaDesc,
      severity: p.severity,
      url: (feature as { id?: string }).id,
    };
  },
});

// Tier-S #18 — EPA ECHO enforcement (no auth).
export const epaEchoEnforcement = defineSource({
  slug: "epa_echo_enforcement",
  product: "industry_pulse",
  host: "echodata.epa.gov",
  rps: 1,
  fetch: async (ctx) => {
    return await ctx.fetchJson(
      "https://echodata.epa.gov/echo/case_rest_services.get_cases?output=JSON&p_st=MI&p_act_lim=90",
    );
  },
  extractRows: (payload) =>
    ((payload as { Results?: { Cases?: unknown[] } })?.Results?.Cases ?? []) as Record<string, unknown>[],
});

// Usage in a dispatcher:
//
//   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
//   import { runSources } from "../_shared/source-framework.ts";
//   import { nwsActiveAlerts, epaEchoEnforcement } from "../_shared/source-framework.example.ts";
//
//   const sb = createClient(SUPABASE_URL, SERVICE_KEY);
//   const results = await runSources(sb, [nwsActiveAlerts, epaEchoEnforcement], { concurrency: 5 });
//   console.log(results); // [{ok:true, slug:"nws_active_alerts", rows:42, durationMs:812}, ...]
