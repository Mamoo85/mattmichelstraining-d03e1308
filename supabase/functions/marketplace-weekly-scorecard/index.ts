// marketplace-weekly-scorecard — Friday 9am ET cron
// Emails buyers their week of activity + missed leads.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to, subject, html }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Active buyers = anyone with a purchase OR watch in last 30d
  const { data: locks } = await supabase
    .from("marketplace_lead_locks")
    .select("buyer_email, product, amount_cents, created_at")
    .eq("status", "sold")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

  const buyerStats = new Map<string, { purchased: number; spent: number; products: Set<string> }>();
  for (const l of locks || []) {
    if (!l.buyer_email) continue;
    const cur = buyerStats.get(l.buyer_email) || { purchased: 0, spent: 0, products: new Set() };
    if (new Date(l.created_at).toISOString() >= since) {
      cur.purchased += 1;
      cur.spent += l.amount_cents || 0;
    }
    cur.products.add(l.product);
    buyerStats.set(l.buyer_email, cur);
  }

  // Count this week's new leads per product to highlight what they missed
  const { data: newLeads } = await supabase
    .from("mortgage_radar_leads")
    .select("id, product")
    .gte("created_at", since);

  const newByProduct = new Map<string, number>();
  for (const l of newLeads || []) {
    newByProduct.set(l.product, (newByProduct.get(l.product) || 0) + 1);
  }

  let sent = 0;
  for (const [email, stats] of buyerStats) {
    const productList = [...stats.products];
    const totalNew = productList.reduce((sum, p) => sum + (newByProduct.get(p) || 0), 0);
    const missed = Math.max(0, totalNew - stats.purchased);
    const html = `
      <h2 style="font-family:system-ui">📊 Your Weekly Marketplace Scorecard</h2>
      <table style="font-family:system-ui;border-collapse:collapse">
        <tr><td><strong>Leads purchased this week:</strong></td><td>${stats.purchased}</td></tr>
        <tr><td><strong>Total spent:</strong></td><td>$${(stats.spent / 100).toFixed(2)}</td></tr>
        <tr><td><strong>New leads in your products:</strong></td><td>${totalNew}</td></tr>
        <tr><td><strong>Leads you missed:</strong></td><td style="color:#f59e0b">${missed}</td></tr>
      </table>
      <p style="margin-top:20px"><a href="https://detroitwebagent.com/marketplace" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Marketplace →</a></p>
    `;
    await sendEmail(email, "📊 Your weekly scorecard", html);
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
