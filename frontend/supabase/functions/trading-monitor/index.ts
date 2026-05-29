/**
 * trading-monitor — Phase 95
 * Real-time dashboard for both Robinhood and Kalshi autonomous bots.
 * Returns JSON status — can be polled by frontend or SMS digest.
 *
 * GET /trading-monitor          → full JSON dashboard
 * GET /trading-monitor?sms=1    → triggers SMS summary to ADMIN_PHONE
 *
 * No auth required (verify_jwt=false) — internal use only, data is non-sensitive.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours = bot might be stuck

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const sendSmsFlag = url.searchParams.get("sms") === "1";

    // ── Fetch bot health ──────────────────────────────────────────────────
    const { data: health } = await supabase
      .from("trading_bot_health")
      .select("*")
      .order("bot_id");

    // ── Robinhood recent trades (last 10) ─────────────────────────────────
    const { data: rhTrades } = await supabase
      .from("robinhood_trades")
      .select("created_at, action, ticker, quantity, price, total_value, pnl, pnl_pct, reason")
      .order("created_at", { ascending: false })
      .limit(10);

    // ── Robinhood current position ────────────────────────────────────────
    const { data: rhPosition } = await supabase
      .from("robinhood_position_state")
      .select("*")
      .eq("account_number", "5SE86534")
      .maybeSingle();

    // ── Kalshi recent trades (last 10) ────────────────────────────────────
    const { data: kalshiTrades } = await supabase
      .from("kalshi_trades")
      .select("created_at, action, ticker, event_title, contracts, price_cents, pnl_cents, pnl_pct, reason")
      .order("created_at", { ascending: false })
      .limit(10);

    // ── Kalshi open positions ─────────────────────────────────────────────
    const { data: kalshiPositions } = await supabase
      .from("kalshi_positions")
      .select("*");

    // ── Performance stats ─────────────────────────────────────────────────
    const { data: rhStats } = await supabase
      .from("robinhood_trades")
      .select("action, pnl")
      .in("action", ["BUY", "SELL"]);

    const { data: kalshiStats } = await supabase
      .from("kalshi_trades")
      .select("action, pnl_cents");

    const rhWins = rhStats?.filter(t => t.action === "SELL" && (t.pnl ?? 0) > 0).length ?? 0;
    const rhLosses = rhStats?.filter(t => t.action === "SELL" && (t.pnl ?? 0) <= 0).length ?? 0;
    const rhTotalPnl = rhStats?.reduce((s, t) => s + (t.pnl ?? 0), 0) ?? 0;

    const kWins = kalshiStats?.filter(t => (t.pnl_cents ?? 0) > 0).length ?? 0;
    const kLosses = kalshiStats?.filter(t => (t.pnl_cents ?? 0) < 0).length ?? 0;
    const kTotalPnlCents = kalshiStats?.reduce((s, t) => s + (t.pnl_cents ?? 0), 0) ?? 0;

    // ── Stale check ───────────────────────────────────────────────────────
    const now = Date.now();
    const staleAlerts: string[] = [];
    for (const bot of health ?? []) {
      const lastRun = bot.last_run_at ? new Date(bot.last_run_at).getTime() : 0;
      if (now - lastRun > STALE_THRESHOLD_MS) {
        staleAlerts.push(`${bot.bot_id} bot hasn't run in ${Math.round((now - lastRun) / 3600000)}h`);
      }
      if ((bot.consecutive_errors ?? 0) >= 3) {
        staleAlerts.push(`${bot.bot_id} bot has ${bot.consecutive_errors} consecutive errors: ${bot.last_error}`);
      }
    }

    const dashboard = {
      generated_at: new Date().toISOString(),
      alerts: staleAlerts,
      robinhood: {
        health: health?.find(h => h.bot_id === "robinhood") ?? null,
        current_position: rhPosition,
        recent_trades: rhTrades ?? [],
        stats: {
          wins: rhWins,
          losses: rhLosses,
          win_rate: rhWins + rhLosses > 0 ? (rhWins / (rhWins + rhLosses) * 100).toFixed(1) + "%" : "N/A",
          total_pnl: `$${rhTotalPnl.toFixed(2)}`,
        },
      },
      kalshi: {
        health: health?.find(h => h.bot_id === "kalshi") ?? null,
        open_positions: kalshiPositions ?? [],
        recent_trades: kalshiTrades ?? [],
        stats: {
          wins: kWins,
          losses: kLosses,
          win_rate: kWins + kLosses > 0 ? (kWins / (kWins + kLosses) * 100).toFixed(1) + "%" : "N/A",
          total_pnl: `$${(kTotalPnlCents / 100).toFixed(2)}`,
        },
      },
    };

    // ── Optional SMS summary ──────────────────────────────────────────────
    if (sendSmsFlag) {
      const rhBot = dashboard.robinhood.health;
      const kBot = dashboard.kalshi.health;
      const rhPos = rhPosition ? `${rhPosition.ticker} (stage ${rhPosition.stage})` : "no position";
      const kPos = (kalshiPositions ?? []).length > 0
        ? kalshiPositions!.map(p => p.ticker).join(", ")
        : "no position";

      const sms = [
        `📊 Trading Bot Status (${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })})`,
        ``,
        `🤖 ROBINHOOD:`,
        `  Balance: $${rhBot?.current_balance?.toFixed(2) ?? "?"}`,
        `  Position: ${rhPos}`,
        `  W/L: ${rhStats?.length ? `${rhWins}W/${rhLosses}L` : "0 trades"}`,
        `  P&L: $${rhTotalPnl.toFixed(2)}`,
        staleAlerts.filter(a => a.includes("robinhood")).map(a => `  ⚠️ ${a}`).join("\n"),
        ``,
        `🎯 KALSHI:`,
        `  Balance: $${kBot?.current_balance?.toFixed(2) ?? "?"}`,
        `  Position: ${kPos}`,
        `  W/L: ${kalshiStats?.length ? `${kWins}W/${kLosses}L` : "0 trades"}`,
        `  P&L: $${(kTotalPnlCents / 100).toFixed(2)}`,
        staleAlerts.filter(a => a.includes("kalshi")).map(a => `  ⚠️ ${a}`).join("\n"),
        staleAlerts.length > 0 ? `\n🚨 ALERTS: ${staleAlerts.length}` : `\n✅ All systems nominal`,
      ].filter(Boolean).join("\n");

      await sendSMS(ADMIN_PHONE, TWILIO_FROM, sms, "trading_monitor");
    }

    return new Response(JSON.stringify(dashboard, null, 2), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[TRADING-MONITOR] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
