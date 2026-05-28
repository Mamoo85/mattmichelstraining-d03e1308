// Order router: takes a Signal, applies sizing + risk, places (or paper-records) order.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { placeOrder, isConfigured as kalshiConfigured } from "./client.ts";
import { sizeOrder } from "./sizer.ts";
import { preTradeRiskCheck } from "./risk.ts";

export interface Signal {
  strategy_id: string;
  market_ticker: string;
  side: "YES" | "NO";
  conviction: number;
  edge_bps: number;
  fair_price_cents: number;
  market_price_cents: number;
  ttl_seconds?: number;
  meta?: Record<string, unknown>;
}

const DEFAULT_CAPITAL_USD = Number(Deno.env.get("KALSHI_CAPITAL_USD") ?? "100");

export async function routeSignal(
  sb: SupabaseClient,
  signal: Signal,
): Promise<{ ok: boolean; reason?: string; order_id?: string; contracts?: number }> {
  // 1) Persist the signal first (always — even if we skip it)
  const { data: sig, error: sigErr } = await sb
    .from("kalshi_signals")
    .insert({
      strategy_id: signal.strategy_id,
      market_ticker: signal.market_ticker,
      side: signal.side,
      conviction: signal.conviction,
      edge_bps: signal.edge_bps,
      fair_price_cents: signal.fair_price_cents,
      market_price_cents: signal.market_price_cents,
      ttl_seconds: signal.ttl_seconds ?? 300,
      meta: signal.meta ?? {},
    })
    .select("id")
    .single();
  if (sigErr) return { ok: false, reason: `signal_insert: ${sigErr.message}` };

  // 2) Load strategy config
  const { data: strat } = await sb
    .from("kalshi_strategies")
    .select("kelly_frac, max_position_usd, min_edge_bps, paper_only")
    .eq("id", signal.strategy_id)
    .single();
  if (!strat) return { ok: false, reason: "no_strategy" };

  // 3) Min-edge gate
  if (signal.edge_bps < (strat.min_edge_bps ?? 300)) {
    return { ok: false, reason: `edge_too_thin_${signal.edge_bps}` };
  }

  // 4) Decide paper vs live
  const isPaper = strat.paper_only || !kalshiConfigured();

  // 5) Risk check
  const risk = await preTradeRiskCheck(sb, signal.strategy_id, isPaper);
  if (!risk.ok) return { ok: false, reason: risk.reason };

  // 6) Size
  const sized = sizeOrder({
    capitalUsd: DEFAULT_CAPITAL_USD,
    kellyFrac: Number(strat.kelly_frac ?? 0.25),
    conviction: signal.conviction,
    edgeBps: signal.edge_bps,
    marketPriceCents: signal.market_price_cents,
    maxPositionUsd: Number(strat.max_position_usd ?? 25),
  });
  if (sized.contracts < 1) return { ok: false, reason: "size_zero" };

  // 7) Record order intent
  const { data: ord } = await sb
    .from("kalshi_orders")
    .insert({
      signal_id: sig.id,
      strategy_id: signal.strategy_id,
      market_ticker: signal.market_ticker,
      side: signal.side,
      action: "buy",
      qty: sized.contracts,
      limit_price_cents: signal.market_price_cents,
      is_paper: isPaper,
      status: isPaper ? "paper" : "pending",
    })
    .select("id")
    .single();

  // 8) Mark signal acted-on
  await sb.from("kalshi_signals").update({ acted_on: true }).eq("id", sig.id);

  if (isPaper) {
    return { ok: true, order_id: ord?.id, contracts: sized.contracts, reason: "paper" };
  }

  // 9) Live order
  try {
    const result = await placeOrder({
      ticker: signal.market_ticker,
      side: signal.side.toLowerCase() as "yes" | "no",
      action: "buy",
      type: "limit",
      count: sized.contracts,
      yes_price: signal.side === "YES" ? signal.market_price_cents : undefined,
      no_price: signal.side === "NO" ? signal.market_price_cents : undefined,
      client_order_id: ord!.id,
    });
    await sb
      .from("kalshi_orders")
      .update({ kalshi_order_id: result.order.order_id, status: "open" })
      .eq("id", ord!.id);
    return { ok: true, order_id: ord?.id, contracts: sized.contracts };
  } catch (e) {
    await sb
      .from("kalshi_orders")
      .update({ status: "rejected", error: (e as Error).message })
      .eq("id", ord!.id);
    return { ok: false, reason: (e as Error).message };
  }
}
