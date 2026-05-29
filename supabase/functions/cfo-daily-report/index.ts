// cfo-daily-report — Daily P&L briefing for the AI Corporation Chairman (Matt)
//
// Runs 6am UTC daily via cron.
// Pulls revenue from Gumroad + Shopify + KDP books table + fiverr_orders,
// computes daily P&L, surfaces pending spending_approvals with APPROVE/DENY links,
// emails a styled executive dashboard.
//
// Matt is the Chairman. He only acts on net-loss decisions.
// Everything else runs autonomously.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") || "";
const GUMROAD_TOKEN  = Deno.env.get("GUMROAD_ACCESS_TOKEN") || "";
const SHOPIFY_DOMAIN = Deno.env.get("SHOPIFY_SHOP_DOMAIN") || "";
const SHOPIFY_TOKEN  = Deno.env.get("SHOPIFY_ACCESS_TOKEN") || "";
const REMOTE_SECRET  = Deno.env.get("REMOTE_CONTROL_SECRET") || "";
const OWNER_EMAIL    = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[CFO] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

// ── Revenue fetchers ───────────────────────────────────────────────────────────

async function fetchGumroadRevenue(): Promise<{ revenue: number; orders: number; products: number }> {
  if (!GUMROAD_TOKEN) return { revenue: 0, orders: 0, products: 0 };
  try {
    const res = await fetch(`https://api.gumroad.com/v2/sales?access_token=${GUMROAD_TOKEN}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { revenue: 0, orders: 0, products: 0 };
    const data = await res.json();
    const sales = (data.sales || []) as Array<{ price: number; created_at: string }>;
    // Only count sales from today
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter(s => (s.created_at || "").slice(0, 10) === todayStr);
    const revenue = todaySales.reduce((sum, s) => sum + (s.price || 0), 0);

    const prodRes = await fetch(`https://api.gumroad.com/v2/products?access_token=${GUMROAD_TOKEN}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const prodData = prodRes.ok ? await prodRes.json() : { products: [] };
    const publishedCount = (prodData.products || []).filter((p: { published: boolean }) => p.published).length;

    return { revenue, orders: todaySales.length, products: publishedCount };
  } catch { return { revenue: 0, orders: 0, products: 0 }; }
}

async function fetchShopifyRevenue(): Promise<{ revenue: number; orders: number }> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) return { revenue: 0, orders: 0 };
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?status=any&created_at_min=${yesterday}&limit=250`;
    const res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { revenue: 0, orders: 0 };
    const data = await res.json();
    const orders = (data.orders || []) as Array<{ total_price: string; financial_status: string }>;
    const paid = orders.filter(o => o.financial_status === "paid");
    const revenue = Math.round(paid.reduce((sum, o) => sum + parseFloat(o.total_price || "0"), 0) * 100);
    return { revenue, orders: paid.length };
  } catch { return { revenue: 0, orders: 0 }; }
}

async function fetchKdpCount(): Promise<{ live: number; ready: number }> {
  const { count: live } = await sb.from("kdp_books").select("*", { count: "exact", head: true }).eq("status", "gumroad_live");
  const { count: ready } = await sb.from("kdp_books").select("*", { count: "exact", head: true }).eq("status", "ready");
  return { live: live ?? 0, ready: ready ?? 0 };
}

async function fetchFiverrOrders(): Promise<{ today: number; total: number }> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { count: today } = await sb.from("fiverr_orders").select("*", { count: "exact", head: true }).gte("created_at", todayStr);
  const { count: total } = await sb.from("fiverr_orders").select("*", { count: "exact", head: true });
  return { today: today ?? 0, total: total ?? 0 };
}

async function fetchAgentHeartbeats(): Promise<Array<{ agent_name: string; last_run_at: string; last_status: string }>> {
  const { data } = await sb.from("agent_heartbeats")
    .select("agent_name, last_run_at, last_status")
    .in("agent_name", ["cfo-daily-report", "gumroad-digital-creator", "shopify-store-agent", "store-marketing-agent", "fiverr-meta-agent"])
    .order("last_run_at", { ascending: false });
  return data || [];
}

async function fetchPendingApprovals(): Promise<Array<{ id: string; agent: string; description: string; projected_cost_cents: number; projected_revenue_cents: number; created_at: string }>> {
  const { data } = await sb.from("spending_approvals")
    .select("id, agent, description, projected_cost_cents, projected_revenue_cents, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return data || [];
}

async function fetch7DayTrend(): Promise<Array<{ date: string; channel: string; revenue_cents: number; cost_cents: number }>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from("corp_daily_pnl")
    .select("date, channel, revenue_cents, cost_cents")
    .gte("date", sevenDaysAgo)
    .order("date", { ascending: false });
  return data || [];
}

// ── Email builder ──────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildApprovalLink(id: string, action: "approve" | "deny"): string {
  const base = `${SUPABASE_URL}/functions/v1/approve-spend`;
  return `${base}?id=${id}&action=${action}&token=${encodeURIComponent(REMOTE_SECRET)}`;
}

function buildEmail(
  gumroad: { revenue: number; orders: number; products: number },
  shopify: { revenue: number; orders: number },
  kdp: { live: number; ready: number },
  fiverr: { today: number; total: number },
  trend: Array<{ date: string; channel: string; revenue_cents: number; cost_cents: number }>,
  approvals: Array<{ id: string; agent: string; description: string; projected_cost_cents: number; projected_revenue_cents: number; created_at: string }>,
  heartbeats: Array<{ agent_name: string; last_run_at: string; last_status: string }>,
): string {
  const totalRevCents = gumroad.revenue + shopify.revenue;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Detroit" });

  const trendByChannel: Record<string, { rev: number; cost: number }> = {};
  for (const row of trend) {
    if (!trendByChannel[row.channel]) trendByChannel[row.channel] = { rev: 0, cost: 0 };
    trendByChannel[row.channel].rev += row.revenue_cents;
    trendByChannel[row.channel].cost += row.cost_cents;
  }

  const trendRows = Object.entries(trendByChannel).map(([ch, { rev, cost }]) => {
    const profit = rev - cost;
    const color = profit >= 0 ? "#22c55e" : "#ef4444";
    return `<tr>
      <td style="padding:6px 12px;color:#94a3b8;text-transform:capitalize;">${ch}</td>
      <td style="padding:6px 12px;text-align:right;">${fmt(rev)}</td>
      <td style="padding:6px 12px;text-align:right;color:#f59e0b;">${fmt(cost)}</td>
      <td style="padding:6px 12px;text-align:right;color:${color};font-weight:bold;">${fmt(profit)}</td>
    </tr>`;
  }).join("");

  const approvalCards = approvals.map(a => {
    const profit = a.projected_revenue_cents - a.projected_cost_cents;
    const isLoss = profit < 0;
    const approveUrl = buildApprovalLink(a.id, "approve");
    const denyUrl = buildApprovalLink(a.id, "deny");
    return `
    <div style="background:#1e293b;border:1px solid ${isLoss ? "#ef4444" : "#f59e0b"};border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">${a.agent} · ${new Date(a.created_at).toLocaleDateString()}</div>
      <div style="font-size:14px;color:#e2e8f0;margin-bottom:8px;">${a.description}</div>
      <div style="font-size:12px;margin-bottom:12px;">
        <span style="color:#f59e0b;">Cost: ${fmt(a.projected_cost_cents)}</span> &nbsp;·&nbsp;
        <span style="color:#22c55e;">Revenue: ${fmt(a.projected_revenue_cents)}</span> &nbsp;·&nbsp;
        <span style="color:${isLoss ? "#ef4444" : "#22c55e"};font-weight:bold;">Net: ${fmt(profit)}</span>
      </div>
      <a href="${approveUrl}" style="background:#22c55e;color:#000;padding:8px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;margin-right:8px;">✅ APPROVE</a>
      <a href="${denyUrl}" style="background:#ef4444;color:#fff;padding:8px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">❌ DENY</a>
    </div>`;
  }).join("");

  const hbRows = heartbeats.map(hb => {
    const ago = hb.last_run_at ? Math.round((Date.now() - new Date(hb.last_run_at).getTime()) / 3600000) : null;
    const dot = hb.last_status === "ok" ? "🟢" : "🔴";
    return `<tr>
      <td style="padding:5px 10px;font-family:monospace;font-size:12px;color:#a78bfa;">${hb.agent_name}</td>
      <td style="padding:5px 10px;font-size:12px;">${dot} ${hb.last_status}</td>
      <td style="padding:5px 10px;font-size:12px;color:#64748b;">${ago !== null ? `${ago}h ago` : "never"}</td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">

  <div style="margin-bottom:20px;">
    <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:1px;">AI Corporation · Daily Briefing</div>
    <h1 style="margin:4px 0 0;font-size:22px;color:#ffffff;">${today}</h1>
  </div>

  <!-- Revenue Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
    <div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:#64748b;">GUMROAD TODAY</div>
      <div style="font-size:22px;font-weight:bold;color:#22c55e;">${fmt(gumroad.revenue)}</div>
      <div style="font-size:11px;color:#64748b;">${gumroad.orders} orders · ${gumroad.products} products</div>
    </div>
    <div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:#64748b;">SHOPIFY TODAY</div>
      <div style="font-size:22px;font-weight:bold;color:#3b82f6;">${fmt(shopify.revenue)}</div>
      <div style="font-size:11px;color:#64748b;">${shopify.orders} orders</div>
    </div>
    <div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:#64748b;">KDP BOOKS</div>
      <div style="font-size:22px;font-weight:bold;color:#a78bfa;">${kdp.live}</div>
      <div style="font-size:11px;color:#64748b;">${kdp.ready} ready to upload</div>
    </div>
    <div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:#64748b;">FIVERR ORDERS</div>
      <div style="font-size:22px;font-weight:bold;color:#f59e0b;">${fiverr.today}</div>
      <div style="font-size:11px;color:#64748b;">${fiverr.total} total all-time</div>
    </div>
  </div>

  <!-- Total -->
  <div style="background:#134e4a;border:1px solid #10b981;border-radius:8px;padding:14px;text-align:center;margin-bottom:24px;">
    <div style="font-size:13px;color:#6ee7b7;">TOTAL DIGITAL REVENUE TODAY</div>
    <div style="font-size:32px;font-weight:bold;color:#10b981;">${fmt(totalRevCents)}</div>
  </div>

  ${trend.length > 0 ? `
  <!-- 7-Day Trend -->
  <h3 style="color:#a78bfa;margin:0 0 10px;">7-Day Channel Trend</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#1e293b;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="border-bottom:1px solid #334155;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;">CHANNEL</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;">REVENUE</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;">COSTS</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;">NET</th>
      </tr>
    </thead>
    <tbody>${trendRows}</tbody>
  </table>` : ""}

  ${approvals.length > 0 ? `
  <!-- Board Decisions Needed -->
  <div style="background:#7c2d12;border:1px solid #f97316;border-radius:8px;padding:16px;margin-bottom:20px;">
    <h3 style="color:#fed7aa;margin:0 0 4px;">🏛️ Board Decisions Required (${approvals.length})</h3>
    <p style="color:#fdba74;font-size:13px;margin:0 0 16px;">These decisions need your approval — click once, they're done.</p>
    ${approvalCards}
  </div>` : `
  <div style="background:#14532d;border:1px solid #22c55e;border-radius:8px;padding:12px;margin-bottom:20px;text-align:center;">
    <span style="color:#86efac;">✅ No pending decisions — all agents running autonomously</span>
  </div>`}

  ${heartbeats.length > 0 ? `
  <!-- Agent Heartbeats -->
  <h3 style="color:#a78bfa;margin:0 0 10px;">Corporate Agent Status</h3>
  <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:16px;">
    <tbody>${hbRows}</tbody>
  </table>` : ""}

  <div style="text-align:center;font-size:11px;color:#334155;margin-top:20px;">
    AI Corporation · M² Automation · cfo-daily-report runs 6am UTC daily
  </div>
</div>`;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  log("Starting CFO daily report");

  try {
    const [gumroad, shopify, kdp, fiverr, trend, approvals, heartbeats] = await Promise.all([
      fetchGumroadRevenue(),
      fetchShopifyRevenue(),
      fetchKdpCount(),
      fetchFiverrOrders(),
      fetch7DayTrend(),
      fetchPendingApprovals(),
      fetchAgentHeartbeats(),
    ]);

    log("Data fetched", { gumroadRev: gumroad.revenue, shopifyRev: shopify.revenue, approvals: approvals.length });

    // Record today's revenue in corp_daily_pnl
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([
      gumroad.revenue > 0 && sb.from("corp_daily_pnl").upsert(
        { date: today, channel: "gumroad", revenue_cents: gumroad.revenue, order_count: gumroad.orders },
        { onConflict: "date,channel", ignoreDuplicates: false }
      ),
      shopify.revenue > 0 && sb.from("corp_daily_pnl").upsert(
        { date: today, channel: "shopify", revenue_cents: shopify.revenue, order_count: shopify.orders },
        { onConflict: "date,channel", ignoreDuplicates: false }
      ),
    ].filter(Boolean));

    // Build + send email
    const html = buildEmail(gumroad, shopify, kdp, fiverr, trend, approvals, heartbeats);
    const totalRev = gumroad.revenue + shopify.revenue;
    const subject = `💼 CFO Briefing: ${(totalRev / 100).toFixed(2) !== "0.00" ? `$${(totalRev / 100).toFixed(2)} today` : "Day 0 — empire building"} · ${new Date().toLocaleDateString()}`;

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "CFO Report <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject,
          html,
        }),
      });
      log("Email sent");
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "cfo-daily-report",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ gumroad: gumroad.revenue, shopify: shopify.revenue, approvals: approvals.length }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, gumroad, shopify, kdp, fiverr, approvals: approvals.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
