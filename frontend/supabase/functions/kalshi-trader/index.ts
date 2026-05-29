/**
 * kalshi-trader — Phase 95
 * Kalshi prediction market trading bot with RSA-PSS authentication.
 * Called by the autonomous scheduled agent.
 *
 * POST body: {
 *   action: "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO" | "HOLD" | "HALT" | "STATUS",
 *   ticker?: string,
 *   contracts?: number,
 *   price_cents?: number,   // limit price (1-99)
 *   reason?: string,
 *   stage?: number,
 *   kelly_fraction?: number,
 *   implied_prob?: number,
 *   edge?: number,
 *   event_title?: string
 * }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KALSHI_BASE = "https://api.elections.kalshi.com";
const BALANCE_FLOOR_CENTS = 2000; // $20 floor — stop trading

// ── RSA-PSS signing via Web Crypto ──────────────────────────────────────────
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // If already PKCS#8 (-----BEGIN PRIVATE KEY-----), use directly.
  // If PKCS#1 (-----BEGIN RSA PRIVATE KEY-----), wrap it.
  let keyBuffer: ArrayBuffer;
  if (pem.includes("-----BEGIN PRIVATE KEY-----")) {
    keyBuffer = der.buffer;
  } else {
    const octetLen = der.length;
    const innerLen = 2 + 1 + 2 + 13 + 2 + 2 + octetLen;
    const pkcs8 = new Uint8Array(4 + innerLen);
    let off = 0;
    pkcs8[off++] = 0x30; pkcs8[off++] = 0x82;
    pkcs8[off++] = (innerLen >> 8) & 0xFF; pkcs8[off++] = innerLen & 0xFF;
    pkcs8[off++] = 0x02; pkcs8[off++] = 0x01; pkcs8[off++] = 0x00;
    pkcs8[off++] = 0x30; pkcs8[off++] = 0x0D;
    pkcs8[off++] = 0x06; pkcs8[off++] = 0x09;
    pkcs8.set([0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x01,0x01], off); off += 9;
    pkcs8[off++] = 0x05; pkcs8[off++] = 0x00;
    pkcs8[off++] = 0x04; pkcs8[off++] = 0x82;
    pkcs8[off++] = (octetLen >> 8) & 0xFF; pkcs8[off++] = octetLen & 0xFF;
    pkcs8.set(der, off);
    keyBuffer = pkcs8.buffer;
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function kalshiSign(keyPem: string, ts: string, method: string, path: string): Promise<string> {
  const key = await importPrivateKey(keyPem);
  const message = ts + method + path;
  const msgBytes = new TextEncoder().encode(message);
  const sigBytes = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    msgBytes
  );
  return btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
}

async function kalshiRequest(
  keyPem: string,
  keyId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const ts = Date.now().toString();
  // Kalshi signs the path WITHOUT the query string
  const sig = await kalshiSign(keyPem, ts, method, path.split("?")[0]);
  const headers: Record<string, string> = {
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${KALSHI_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kalshi API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const keyPem = Deno.env.get("KALSHI_PRIVATE_KEY_PEM") ?? Deno.env.get("KALSHI_RSA_PRIVATE_KEY") ?? "";
  const keyId  = Deno.env.get("KALSHI_API_KEY_ID") ?? Deno.env.get("KALSHI_KEY_ID") ?? "f0b93dad-0df0-41ba-937d-cc0562cc8c6e";

  if (!keyPem) {
    return new Response(JSON.stringify({ error: "No Kalshi private key found — set KALSHI_PRIVATE_KEY_PEM or KALSHI_RSA_PRIVATE_KEY" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, ticker, contracts, price_cents, reason, stage, kelly_fraction,
            implied_prob, edge, event_title } = body;

    // Always fetch current balance
    const balData: any = await kalshiRequest(keyPem, keyId, "GET", "/trade-api/v2/portfolio/balance");
    const balanceCents: number = Math.round(parseFloat(balData.balance_dollars) * 100);

    console.log(`[KALSHI-TRADER] action=${action} balance=$${(balanceCents/100).toFixed(2)}`);

    // STATUS: just return balance + positions
    if (action === "STATUS") {
      const posData: any = await kalshiRequest(keyPem, keyId, "GET", "/trade-api/v2/portfolio/positions");
      return new Response(JSON.stringify({
        balance_cents: balanceCents,
        balance_dollars: (balanceCents / 100).toFixed(2),
        positions: posData.market_positions ?? [],
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Update health record — last_run_at
    await supabase.from("trading_bot_health").upsert({
      bot_id: "kalshi",
      last_run_at: new Date().toISOString(),
      current_balance: balanceCents / 100,
      updated_at: new Date().toISOString(),
    }, { onConflict: "bot_id" });

    // HALT: floor hit
    if (action === "HALT" || balanceCents < BALANCE_FLOOR_CENTS) {
      const msg = `🚨 KALSHI HALT — balance $${(balanceCents/100).toFixed(2)} hit $${BALANCE_FLOOR_CENTS/100} floor. All trading stopped.`;
      await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "kalshi_trader");
      await supabase.from("kalshi_trades").insert({
        action: "HALT", balance_before: balanceCents, balance_after: balanceCents,
        reason: reason ?? "Balance floor hit",
      });
      return new Response(JSON.stringify({ halted: true, balance_cents: balanceCents }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // HOLD / NO_ACTION: just log
    if (action === "HOLD" || action === "NO_ACTION") {
      await supabase.from("kalshi_trades").insert({
        action, ticker, balance_before: balanceCents, balance_after: balanceCents, reason, stage,
        implied_prob, edge, kelly_fraction, event_title,
      });
      return new Response(JSON.stringify({ action, balance_cents: balanceCents }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // BUY or SELL
    if (!ticker || !contracts || !price_cents) {
      return new Response(JSON.stringify({ error: "ticker, contracts, price_cents required for BUY/SELL" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const isBuy = action.startsWith("BUY");
    const side  = action.endsWith("YES") ? "yes" : "no";
    const totalCost = contracts * price_cents;

    if (isBuy && totalCost > balanceCents) {
      return new Response(JSON.stringify({ error: `Insufficient balance: need ${totalCost}¢, have ${balanceCents}¢` }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Place order via Kalshi API.
    // Kalshi requires EXACTLY ONE of yes_price / no_price (sending both → 400
    // "invalid_order"). price_cents is the limit price for the chosen side.
    const orderPayload: Record<string, unknown> = {
      ticker,
      action: isBuy ? "buy" : "sell",
      side,
      type: "limit",
      count: contracts,
      client_order_id: crypto.randomUUID(),
    };
    if (side === "yes") orderPayload.yes_price = price_cents;
    else orderPayload.no_price = price_cents;

    const orderResp: any = await kalshiRequest(keyPem, keyId, "POST", "/trade-api/v2/portfolio/orders", orderPayload);
    const orderId = orderResp?.order?.order_id ?? orderResp?.order_id ?? "unknown";

    // Fetch updated balance
    const balAfterData: any = await kalshiRequest(keyPem, keyId, "GET", "/trade-api/v2/portfolio/balance");
    const balAfterCents: number = Math.round(parseFloat(balAfterData.balance_dollars) * 100);

    const pnlCents = isBuy ? 0 : (balAfterCents - balanceCents); // P&L realized on sell

    // Log to Supabase
    await supabase.from("kalshi_trades").insert({
      action, ticker, event_title, contracts, price_cents, side,
      total_cost_cents: totalCost,
      balance_before: balanceCents,
      balance_after: balAfterCents,
      pnl_cents: pnlCents,
      pnl_pct: pnlCents ? (pnlCents / totalCost) : null,
      kelly_fraction, implied_prob, edge,
      reason, stage, order_id: orderId,
    });

    // Update positions
    if (isBuy) {
      await supabase.from("kalshi_positions").upsert({
        ticker, event_title, side, contracts,
        avg_price_cents: price_cents,
        entry_time: new Date().toISOString(),
        stage, updated_at: new Date().toISOString(),
      }, { onConflict: "ticker" });
    } else {
      await supabase.from("kalshi_positions").delete().eq("ticker", ticker);
    }

    // Update health
    await supabase.from("trading_bot_health")
      .update({
        last_success_at: new Date().toISOString(),
        consecutive_errors: 0,
        current_balance: balAfterCents / 100,
        total_trades: supabase.rpc ? undefined : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("bot_id", "kalshi");

    // SMS notification
    const emoji = isBuy ? "📈" : "💰";
    const pnlStr = pnlCents ? ` | P&L: ${pnlCents > 0 ? "+" : ""}$${(pnlCents/100).toFixed(2)}` : "";
    const smsMsg = `${emoji} Kalshi ${action}: ${contracts}x ${ticker} @${price_cents}¢\n${reason ?? ""}\nBalance: $${(balAfterCents/100).toFixed(2)}${pnlStr}`;
    await sendSMS(ADMIN_PHONE, TWILIO_FROM, smsMsg, "kalshi_trader");

    console.log(`[KALSHI-TRADER] ${action} ${contracts}x ${ticker} @${price_cents}¢ order=${orderId}`);

    return new Response(JSON.stringify({
      success: true, action, ticker, contracts, price_cents, side,
      order_id: orderId, balance_cents: balAfterCents,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[KALSHI-TRADER] Error:", err);

    // Record error in health
    const supabase2 = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase2.from("trading_bot_health")
      .update({
        last_run_at: new Date().toISOString(),
        last_error: String(err),
        updated_at: new Date().toISOString(),
      })
      .eq("bot_id", "kalshi");

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
