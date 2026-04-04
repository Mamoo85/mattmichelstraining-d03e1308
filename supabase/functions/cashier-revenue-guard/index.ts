import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function stripeGet(endpoint: string) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

async function sendCashierEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Cashier <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#022c22;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">💰</span>
          <strong style="color:#10b981;font-size:16px;">Agent Cashier — Revenue Guard</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const alerts: string[] = [];

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "No STRIPE_SECRET_KEY" }), {
        status: 500, headers: CORS,
      });
    }

    // 1. Failed payments in last 7 days
    const weekAgoUnix = Math.floor((Date.now() - 7 * 86400000) / 1000);
    const failedCharges = await stripeGet(`/charges?limit=20&created[gte]=${weekAgoUnix}&status=failed`);

    if (failedCharges.data?.length) {
      const lostRevenue = failedCharges.data.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) / 100;
      alerts.push(`<h3 style="color:#ef4444;">❌ ${failedCharges.data.length} Failed Payments — $${lostRevenue.toFixed(2)} lost</h3>
        <ul>${failedCharges.data.slice(0, 10).map((c: any) => 
          `<li>${c.billing_details?.email || "Unknown"} — $${(c.amount / 100).toFixed(2)} — ${c.failure_message || "card declined"}</li>`
        ).join("")}</ul>`);
    }

    // 2. Recent cancellations
    const cancelledSubs = await stripeGet(`/subscriptions?limit=20&status=canceled&created[gte]=${weekAgoUnix}`);

    if (cancelledSubs.data?.length) {
      const lostMrr = cancelledSubs.data.reduce((sum: number, s: any) => {
        const item = s.items?.data?.[0];
        return sum + ((item?.price?.unit_amount || 0) / 100);
      }, 0);
      alerts.push(`<h3 style="color:#f59e0b;">📉 ${cancelledSubs.data.length} Cancellations — $${lostMrr.toFixed(2)}/mo MRR lost</h3>
        <ul>${cancelledSubs.data.slice(0, 10).map((s: any) => {
          const item = s.items?.data?.[0];
          return `<li>${s.customer} — ${item?.price?.nickname || "subscription"} — $${((item?.price?.unit_amount || 0) / 100).toFixed(2)}/mo</li>`;
        }).join("")}</ul>`);
    }

    // 3. Past-due subscriptions (still active but payment failed)
    const pastDue = await stripeGet("/subscriptions?limit=20&status=past_due");

    if (pastDue.data?.length) {
      const atRisk = pastDue.data.reduce((sum: number, s: any) => {
        const item = s.items?.data?.[0];
        return sum + ((item?.price?.unit_amount || 0) / 100);
      }, 0);
      alerts.push(`<h3 style="color:#f97316;">⚠️ ${pastDue.data.length} Past-Due Subscriptions — $${atRisk.toFixed(2)}/mo at risk</h3>
        <p>These customers' cards failed but subscriptions haven't been cancelled yet. Reach out before Stripe cancels them.</p>
        <ul>${pastDue.data.slice(0, 10).map((s: any) => `<li>${s.customer}</li>`).join("")}</ul>`);
    }

    // 4. Active subscription count & MRR snapshot
    const activeSubs = await stripeGet("/subscriptions?limit=100&status=active");
    let totalMrr = 0;
    activeSubs.data?.forEach((s: any) => {
      s.items?.data?.forEach((item: any) => {
        const amount = (item.price?.unit_amount || 0) / 100;
        const interval = item.price?.recurring?.interval;
        totalMrr += interval === "year" ? amount / 12 : amount;
      });
    });

    const summaryHtml = `<h3 style="color:#10b981;">📊 Revenue Snapshot</h3>
      <p>Active subscriptions: <strong>${activeSubs.data?.length || 0}</strong></p>
      <p>Estimated MRR: <strong style="color:#10b981;font-size:18px;">$${totalMrr.toFixed(2)}/mo</strong></p>`;

    if (alerts.length > 0) {
      await sendCashierEmail(
        `💰 Cashier: ${failedCharges.data?.length || 0} failed, ${cancelledSubs.data?.length || 0} cancelled, MRR $${totalMrr.toFixed(0)}`,
        alerts.join("") + summaryHtml
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      failed_payments: failedCharges.data?.length || 0,
      cancellations: cancelledSubs.data?.length || 0,
      past_due: pastDue.data?.length || 0,
      active_subs: activeSubs.data?.length || 0,
      estimated_mrr: totalMrr,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[CASHIER]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
