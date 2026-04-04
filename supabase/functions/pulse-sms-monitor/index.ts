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

// SMS-specific products with their sequence tables
const SMS_PRODUCTS = [
  { table: "sms_blast_clients", name: "Weekly SMS Blast", lastField: "last_blast_at", maxDays: 8 },
  { table: "noshow_clients", name: "No-Show Re-Booker", lastField: "last_sent_at", maxDays: 30 },
  { table: "estimate_drip_clients", name: "Estimate Follow-Up", lastField: "last_sent_at", maxDays: 7 },
  { table: "invoice_chaser_clients", name: "Invoice Chaser", lastField: "last_sent_at", maxDays: 7 },
  { table: "afterjob_drip_clients", name: "After-Job Drip", lastField: "last_sent_at", maxDays: 7 },
  { table: "slow_day_clients", name: "Slow Day SMS", lastField: "last_blast_at", maxDays: 14 },
  { table: "promo_blaster_clients", name: "Seasonal Promos", lastField: "last_promo_at", maxDays: 30 },
];

const SEQUENCE_TABLES = [
  { table: "afterjob_sequences", stoppedField: "stopped", nextField: "next_send_at", name: "After-Job Sequences" },
  { table: "estimate_sequences", stoppedField: "stopped", nextField: "next_send_at", name: "Estimate Sequences" },
  { table: "tracked_invoices", stoppedField: "paid", nextField: "next_reminder_at", name: "Invoice Reminders" },
];

async function sendPulseEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Pulse <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#172554;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">📡</span>
          <strong style="color:#3b82f6;font-size:16px;">Agent Pulse — SMS Health Monitor</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const issues: string[] = [];
    const healthy: string[] = [];
    let stuckSequences = 0;

    // Check each SMS product for overdue sends
    for (const product of SMS_PRODUCTS) {
      try {
        const cutoff = new Date(Date.now() - product.maxDays * 86400000).toISOString();
        const { data: overdue } = await sb
          .from(product.table)
          .select("business_name, email")
          .eq("active", true)
          .lt(product.lastField, cutoff)
          .limit(10);

        const { count: activeCount } = await sb
          .from(product.table)
          .select("id", { count: "exact", head: true })
          .eq("active", true);

        if (overdue?.length) {
          issues.push(`<div style="margin:6px 0;padding:8px;background:#1e3a5f;border-left:3px solid #f59e0b;border-radius:4px;">
            <strong>${product.name}</strong>: ${overdue.length}/${activeCount || "?"} overdue (${product.maxDays}+ days)<br/>
            ${overdue.slice(0, 3).map(c => `• ${c.business_name}`).join("<br/>")}
          </div>`);
        } else {
          healthy.push(`${product.name}: ${activeCount || 0} active ✅`);
        }
      } catch { /* table may not exist */ }
    }

    // Check sequence tables for stuck items
    for (const seq of SEQUENCE_TABLES) {
      try {
        const { data: stuck } = await sb
          .from(seq.table)
          .select("id, client_id")
          .eq(seq.stoppedField, false)
          .lt(seq.nextField, new Date().toISOString())
          .limit(20);

        if (stuck?.length) {
          stuckSequences += stuck.length;
          issues.push(`<div style="margin:6px 0;padding:8px;background:#1e3a5f;border-left:3px solid #ef4444;border-radius:4px;">
            <strong>${seq.name}</strong>: ${stuck.length} stuck (past due, not stopped)
          </div>`);
        }
      } catch { /* skip */ }
    }

    const hasIssues = issues.length > 0;

    if (hasIssues) {
      await sendPulseEmail(
        `📡 Pulse: ${issues.length} SMS issues, ${stuckSequences} stuck sequences`,
        `${issues.length ? `<h3 style="color:#f59e0b;">⚠️ Issues Found</h3>${issues.join("")}` : ""}
        ${healthy.length ? `<h3 style="color:#22c55e;">✅ Healthy Products</h3><ul>${healthy.map(h => `<li>${h}</li>`).join("")}</ul>` : ""}`
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      issues: issues.length,
      stuck_sequences: stuckSequences,
      healthy_products: healthy.length,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[PULSE]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
