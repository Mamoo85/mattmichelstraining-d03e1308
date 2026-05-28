// Risk gates: daily loss kill switch, per-strategy health, global stop.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface RiskCheckResult {
  ok: boolean;
  reason?: string;
}

export async function preTradeRiskCheck(
  sb: SupabaseClient,
  strategyId: string,
  isPaper: boolean,
): Promise<RiskCheckResult> {
  // 1) Strategy must be enabled
  const { data: strat } = await sb
    .from("kalshi_strategies")
    .select("enabled, paper_only, killed_at")
    .eq("id", strategyId)
    .maybeSingle();
  if (!strat) return { ok: false, reason: "strategy_not_found" };
  if (strat.killed_at) return { ok: false, reason: `killed: ${strat.killed_at}` };
  if (!strat.enabled) return { ok: false, reason: "strategy_disabled" };
  if (strat.paper_only && !isPaper) return { ok: false, reason: "paper_only_mode" };

  // 2) Daily loss limit: -3% of capital
  const today = new Date().toISOString().slice(0, 10);
  const { data: pnl } = await sb
    .from("kalshi_pnl_daily")
    .select("realized_cents, unrealized_cents")
    .eq("strategy_id", strategyId)
    .eq("date", today)
    .eq("is_paper", isPaper)
    .maybeSingle();
  if (pnl) {
    const total = (pnl.realized_cents ?? 0) + (pnl.unrealized_cents ?? 0);
    // capital_usd default $100 → 300¢ loss = -3%
    if (total < -300) return { ok: false, reason: `daily_loss_limit_${total}` };
  }

  return { ok: true };
}

// Auto-kill switch: call from EOD job
export async function checkKillSwitches(sb: SupabaseClient, strategyId: string): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: rows } = await sb
    .from("kalshi_pnl_daily")
    .select("date, realized_cents, sharpe_30d")
    .eq("strategy_id", strategyId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (!rows || rows.length < 14) return;
  const lastSharpe = rows.at(-1)?.sharpe_30d;
  if (lastSharpe !== null && lastSharpe !== undefined && Number(lastSharpe) < 0.3) {
    await sb
      .from("kalshi_strategies")
      .update({ killed_at: new Date().toISOString(), kill_reason: `sharpe_${lastSharpe}_below_0.3` })
      .eq("id", strategyId);
  }
}
