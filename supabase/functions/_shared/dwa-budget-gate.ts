// DWA global weekly spend cap. Until first paying DWA sale: $5/week hard cap.
// On first sale, stripe-webhook flips weekly_cap_usd to 500 and sets lifted_at.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const sb = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

export class BudgetExceeded extends Error {
  constructor(public provider: string, public cap: number, public spent: number) {
    super(`DWA weekly budget exceeded: ${provider} blocked (spent $${spent.toFixed(2)}/$${cap.toFixed(2)})`);
  }
}

// Hardcoded provider cost estimates (USD per call)
export const PROVIDER_COSTS: Record<string, number> = {
  google_maps_places: 0.017,
  google_address_validation: 0.005,
  google_street_view: 0.007,
  firecrawl: 0.002,
  apollo_people_search: 0.05,
  apollo_org_enrich: 0.10,
  apollo_people_match: 0.10,
  hunter_find: 0.02,
  hunter_verify: 0.005,
  openrouter: 0.01,
  anthropic_opus: 0.05,
  anthropic_haiku: 0.001,
  twilio_sms: 0.0083,
  twilio_lookup: 0.005,
  twilio_voice: 0.014,
  lob_postcard: 0.99,
  lob_letter: 1.50,
  sinch_fax: 0.07,
  browserless: 0.01,
  dataforseo: 0.02,
  clearbit_reveal: 0.10,
  snov: 0.02,
  noaa_cdo: 0.001,
  resend: 0.0004,
};

interface BudgetState {
  weekly_cap_usd: number;
  week_start: string;
  spent_this_week_usd: number;
  paused: boolean;
  lifted_at: string | null;
}

let _cache: { state: BudgetState; at: number } | null = null;
const CACHE_MS = 30_000;

async function getState(): Promise<BudgetState | null> {
  if (!sb) return null;
  if (_cache && Date.now() - _cache.at < CACHE_MS) return _cache.state;
  const { data } = await sb.from("dwa_budget_state").select("*").eq("id", 1).maybeSingle();
  if (!data) return null;

  // Roll the week if needed
  const weekStart = new Date(data.week_start);
  const nowMs = Date.now();
  if (nowMs - weekStart.getTime() >= 7 * 24 * 60 * 60 * 1000) {
    const newStart = new Date();
    newStart.setUTCHours(0, 0, 0, 0);
    newStart.setUTCDate(newStart.getUTCDate() - newStart.getUTCDay());
    await sb.from("dwa_budget_state").update({
      week_start: newStart.toISOString(),
      spent_this_week_usd: 0,
      warning_80_sent_at: null,
      warning_100_sent_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    data.spent_this_week_usd = 0;
    data.week_start = newStart.toISOString();
  }

  _cache = { state: data as BudgetState, at: Date.now() };
  return data as BudgetState;
}

/**
 * Gate a paid API call. Throws BudgetExceeded if the cap is hit.
 * Returns a `log(actualCostUsd?)` callback to record actual spend after the call succeeds.
 */
export async function assertDwaBudget(
  provider: string,
  estCostUsd?: number,
  functionName?: string,
): Promise<(actualCostUsd?: number, meta?: Record<string, unknown>) => void> {
  const est = estCostUsd ?? PROVIDER_COSTS[provider] ?? 0.01;
  const state = await getState();

  // Fail open if we can't read state (don't break production on infra error)
  if (!state) return (_a, _m) => {};

  if (state.paused) {
    throw new BudgetExceeded(provider, state.weekly_cap_usd, state.spent_this_week_usd);
  }
  if (state.spent_this_week_usd + est > state.weekly_cap_usd) {
    throw new BudgetExceeded(provider, state.weekly_cap_usd, state.spent_this_week_usd);
  }

  return (actualCostUsd?: number, meta?: Record<string, unknown>) => {
    const cost = actualCostUsd ?? est;
    if (!sb) return;
    // Fire-and-forget: never block the caller
    sb.from("dwa_spend_ledger").insert({
      function_name: functionName ?? null,
      provider,
      cost_usd: cost,
      meta: meta ?? {},
    }).then(() => {}, () => {});
    // Best-effort spend increment
    sb.from("dwa_budget_state")

      .update({
        spent_this_week_usd: state.spent_this_week_usd + cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .then(() => { _cache = null; }, () => {});
  };
}

/**
 * Convenience wrapper: gate, run, log. Returns null if budget exceeded.
 */
export async function withBudget<T>(
  provider: string,
  fn: () => Promise<T>,
  opts?: { estCostUsd?: number; functionName?: string; actualCost?: (result: T) => number },
): Promise<T | null> {
  try {
    const log = await assertDwaBudget(provider, opts?.estCostUsd, opts?.functionName);
    const result = await fn();
    log(opts?.actualCost ? opts.actualCost(result) : undefined);
    return result;
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      console.warn(`[dwa-budget] ${e.message}`);
      return null;
    }
    throw e;
  }
}
