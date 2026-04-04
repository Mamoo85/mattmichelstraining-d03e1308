import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All B2B product tables to monitor
const PRODUCT_TABLES = [
  { table: "review_monitor_clients", name: "Review Monitor", price: 25, lastField: "last_check_at" },
  { table: "sms_blast_clients", name: "Weekly SMS Blast", price: 19, lastField: "last_blast_at" },
  { table: "noshow_clients", name: "No-Show Re-Booker", price: 25, lastField: "last_sent_at" },
  { table: "estimate_drip_clients", name: "Estimate Follow-Up", price: 39, lastField: "last_sent_at" },
  { table: "invoice_chaser_clients", name: "Invoice Chaser", price: 29, lastField: "last_sent_at" },
  { table: "afterjob_drip_clients", name: "After-Job Drip", price: 29, lastField: "last_sent_at" },
  { table: "promo_blaster_clients", name: "Seasonal Promos", price: 29, lastField: "last_promo_at" },
  { table: "referral_program_clients", name: "Referral Program", price: 39, lastField: "last_sent_at" },
  { table: "slow_day_clients", name: "Slow Day SMS", price: 25, lastField: "last_blast_at" },
  { table: "homeowner_campaign_clients", name: "New Homeowner", price: 59, lastField: "last_sent_at" },
  { table: "gbp_saas_clients", name: "GBP Auto-Poster", price: 49, lastField: "last_posted_at" },
  { table: "blog_post_clients", name: "Blog Writer", price: 39, lastField: "last_sent_at" },
];

async function sendShieldEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Shield <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1c1917;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🛡️</span>
          <strong style="color:#ef4444;font-size:16px;">Agent Shield — Churn Guard</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const critical: string[] = [];
    const warnings: string[] = [];
    let mrrAtRisk = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

    for (const product of PRODUCT_TABLES) {
      try {
        // Active clients who never received a delivery
        const { data: neverDelivered } = await sb
          .from(product.table)
          .select("business_name, email, created_at")
          .eq("active", true)
          .is(product.lastField, null)
          .lt("created_at", sevenDaysAgo)
          .limit(10);

        if (neverDelivered?.length) {
          mrrAtRisk += neverDelivered.length * product.price;
          critical.push(`<div style="margin:8px 0;padding:8px;background:#7f1d1d;border-radius:6px;">
            <strong>${product.name}</strong> — ${neverDelivered.length} client(s) PAYING but NEVER received a delivery<br/>
            ${neverDelivered.map(c => `• ${c.business_name} (${c.email})`).join("<br/>")}
          </div>`);
        }

        // Active clients with no delivery in 14+ days
        const { data: stale } = await sb
          .from(product.table)
          .select("business_name, email")
          .eq("active", true)
          .lt(product.lastField, fourteenDaysAgo)
          .limit(10);

        if (stale?.length) {
          mrrAtRisk += stale.length * product.price;
          warnings.push(`<div style="margin:8px 0;padding:8px;background:#78350f;border-radius:6px;">
            <strong>${product.name}</strong> — ${stale.length} client(s) no delivery in 14+ days<br/>
            ${stale.map(c => `• ${c.business_name}`).join("<br/>")}
          </div>`);
        }
      } catch (e) {
        // Table might not exist yet, skip
        console.log(`[SHIELD] Skipping ${product.table}: ${e}`);
      }
    }

    // Check delivery_failures in last 24h
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: failures, count: failCount } = await sb
      .from("delivery_failures")
      .select("function_name, customer_email, error_message", { count: "exact" })
      .gte("created_at", dayAgo)
      .limit(10);

    let failHtml = "";
    if (failCount && failCount > 0) {
      failHtml = `<h3 style="color:#ef4444;">💥 ${failCount} Delivery Failures (24h)</h3>
        <ul>${failures?.map(f => `<li>${f.function_name} → ${f.customer_email}: ${(f.error_message || "").slice(0, 80)}</li>`).join("") || ""}</ul>`;
    }

    // NEW: 7. Monitor trial-to-paid conversion rates per product
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentConversions } = await sb
      .from("drip_conversions")
      .select("service_interested, stripe_checkout_completed")
      .gte("converted_at", thirtyDaysAgo);

    let conversionHtml = "";
    if (recentConversions?.length) {
      const byService: Record<string, { total: number; paid: number }> = {};
      recentConversions.forEach(c => {
        const svc = c.service_interested || "unknown";
        if (!byService[svc]) byService[svc] = { total: 0, paid: 0 };
        byService[svc].total++;
        if (c.stripe_checkout_completed) byService[svc].paid++;
      });

      const lowConversion = Object.entries(byService).filter(([, s]) => s.total >= 3 && (s.paid / s.total) < 0.3);
      if (lowConversion.length) {
        conversionHtml = `<h3 style="color:#f59e0b;">📉 Low Conversion Alert (&lt;30%)</h3>
          <ul>${lowConversion.map(([svc, s]) => `<li><strong>${svc}</strong>: ${s.paid}/${s.total} converted (${Math.round(s.paid / s.total * 100)}%)</li>`).join("")}</ul>`;
        warnings.push(conversionHtml);
      }
    }

    const hasIssues = critical.length > 0 || warnings.length > 0 || (failCount && failCount > 0);

    if (hasIssues) {
      await sendShieldEmail(
        `🛡️ Shield Alert: $${mrrAtRisk}/mo at risk, ${critical.length} critical`,
        `<h2 style="color:#ef4444;">💰 MRR AT RISK: $${mrrAtRisk}/mo</h2>
        ${critical.length ? `<h3>🔴 CRITICAL — Paying but not receiving value</h3>${critical.join("")}` : ""}
        ${warnings.length ? `<h3>🟡 WARNING — Going stale</h3>${warnings.join("")}` : ""}
        ${failHtml}
        ${conversionHtml}
        <p style="margin-top:16px;color:#94a3b8;">Shield runs daily. If MRR at risk exceeds $100, you'll get a text too.</p>`
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      mrr_at_risk: mrrAtRisk,
      critical_count: critical.length,
      warning_count: warnings.length,
      delivery_failures_24h: failCount || 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[SHIELD]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
