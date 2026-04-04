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

async function sendScoutEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Scout <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1a0a2e;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🔭</span>
          <strong style="color:#c084fc;font-size:16px;">Agent Scout — Competitive Intelligence</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1. Check competitor_watch_clients for active accounts needing reports
    const { data: watchClients } = await sb
      .from("competitor_watch_clients")
      .select("id, business_name, email, competitor_urls, last_report_at")
      .eq("active", true)
      .limit(50);

    // 2. Check battlecard_clients for active accounts
    const { data: battlecardClients } = await sb
      .from("battlecard_clients")
      .select("id, business_name, competitor_names, last_sent_at")
      .eq("active", true)
      .limit(50);

    // 3. Identify overdue reports (14+ days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const overdueWatch = watchClients?.filter(c =>
      !c.last_report_at || c.last_report_at < fourteenDaysAgo
    ) || [];

    const overdueBattlecards = battlecardClients?.filter(c =>
      !c.last_sent_at || c.last_sent_at < fourteenDaysAgo
    ) || [];

    // 4. Market opportunity — businesses with no competitor watch
    const { count: totalB2b } = await sb
      .from("b2b_clients")
      .select("id", { count: "exact", head: true });

    const upsellOpportunity = (totalB2b || 0) - (watchClients?.length || 0);

    let html = `<h3>📊 Intelligence Network Status</h3>
      <p>Active competitor watchers: <strong>${watchClients?.length || 0}</strong></p>
      <p>Active battlecard clients: <strong>${battlecardClients?.length || 0}</strong></p>
      <p>Upsell opportunity (B2B clients without comp watch): <strong>${upsellOpportunity > 0 ? upsellOpportunity : 0}</strong></p>`;

    if (overdueWatch.length) {
      html += `<h3 style="color:#f59e0b;">⏰ ${overdueWatch.length} Overdue Competitor Reports</h3>
        <ul>${overdueWatch.map(c => `<li>${c.business_name} — last report: ${c.last_report_at ? new Date(c.last_report_at).toLocaleDateString() : "NEVER"}</li>`).join("")}</ul>`;
    }

    if (overdueBattlecards.length) {
      html += `<h3 style="color:#f59e0b;">⏰ ${overdueBattlecards.length} Overdue Battlecards</h3>
        <ul>${overdueBattlecards.map(c => `<li>${c.business_name}</li>`).join("")}</ul>`;
    }

    const hasIssues = overdueWatch.length > 0 || overdueBattlecards.length > 0;
    if (hasIssues) {
      await sendScoutEmail(`🔭 Scout: ${overdueWatch.length + overdueBattlecards.length} overdue intelligence reports`, html);
    }

    return new Response(JSON.stringify({
      ok: true,
      active_watchers: watchClients?.length || 0,
      overdue_reports: overdueWatch.length,
      overdue_battlecards: overdueBattlecards.length,
      upsell_opportunity: upsellOpportunity > 0 ? upsellOpportunity : 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[SCOUT]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
