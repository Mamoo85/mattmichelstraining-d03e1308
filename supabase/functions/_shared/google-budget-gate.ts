// =============================================================================
// Google API Budget Gate — hard kill switch keeping monthly Google spend < $20.
// =============================================================================
// Every paid Google Maps call MUST funnel through canCallGoogle() and logCall().
// When daily or monthly cap is hit, canCallGoogle() returns false → caller falls
// back to a free alternative (Census, Nominatim, OSM Overpass) or skips.
// =============================================================================

export type GoogleApi =
  | "address_validation"
  | "places"
  | "streetview"
  | "geocoding"
  | "distance_matrix"
  | "pagespeed"
  | "other";

// USD cents per call (rough Google list prices, 2026)
const COST_CENTS: Record<GoogleApi, number> = {
  address_validation: 0.5,  // $5/1000
  places: 1.7,              // $17/1000 (Place Details)
  streetview: 0.7,          // $7/1000
  geocoding: 0.5,           // $5/1000
  distance_matrix: 0.5,     // $5/1000
  pagespeed: 0,             // free
  other: 1.0,
};

type Cfg = { daily_cap_cents: number; monthly_cap_cents: number; kill_switch: boolean };

let cfgCache: { v: Cfg; at: number } | null = null;

async function getConfig(sb: any): Promise<Cfg> {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.v;
  try {
    const { data } = await sb.from("google_budget_config").select("daily_cap_cents,monthly_cap_cents,kill_switch").eq("id", 1).maybeSingle();
    const v: Cfg = {
      daily_cap_cents: data?.daily_cap_cents ?? 100,
      monthly_cap_cents: data?.monthly_cap_cents ?? 1500,
      kill_switch: data?.kill_switch ?? false,
    };
    cfgCache = { v, at: Date.now() };
    return v;
  } catch {
    return { daily_cap_cents: 100, monthly_cap_cents: 1500, kill_switch: false };
  }
}

export async function canCallGoogle(sb: any, _api: GoogleApi): Promise<boolean> {
  try {
    const cfg = await getConfig(sb);
    if (cfg.kill_switch) return false;

    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(); startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);

    const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
      sb.from("google_api_spend_log").select("cost_cents").gte("called_at", startOfDay.toISOString()),
      sb.from("google_api_spend_log").select("cost_cents").gte("called_at", startOfMonth.toISOString()),
    ]);

    const dayCents = (dayRows || []).reduce((s: number, r: any) => s + Number(r.cost_cents || 0), 0);
    const monthCents = (monthRows || []).reduce((s: number, r: any) => s + Number(r.cost_cents || 0), 0);

    if (dayCents >= cfg.daily_cap_cents) return false;
    if (monthCents >= cfg.monthly_cap_cents) return false;
    return true;
  } catch {
    // Fail-OPEN on infra errors (don't block the world if log table is unreachable)
    // — but only briefly; cache will refresh on next call.
    return true;
  }
}

export async function logGoogleCall(
  sb: any,
  function_name: string,
  api: GoogleApi,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await sb.from("google_api_spend_log").insert({
      function_name,
      api,
      cost_cents: COST_CENTS[api] ?? 1.0,
      meta: meta || null,
    });
  } catch { /* fire-and-forget */ }
}

/** Convenience: check + log in one call. Returns true if you may proceed. */
export async function gateAndLog(sb: any, fn: string, api: GoogleApi, meta?: Record<string, unknown>): Promise<boolean> {
  const ok = await canCallGoogle(sb, api);
  if (ok) await logGoogleCall(sb, fn, api, meta);
  return ok;
}
