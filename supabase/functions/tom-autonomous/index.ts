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

async function sendTomEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Tom <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1a1a2e;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🎯</span>
          <strong style="color:#22d3ee;font-size:16px;">Agent Tom — Lead Hunter</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const alerts: string[] = [];
    const now = new Date();

    // 1. Check for leads that have replied (notes contain "replied" or "interested")
    const { data: hotLeads } = await sb
      .from("web_design_leads")
      .select("id, business_name, email, city, notes, status")
      .or("notes.ilike.%replied%,notes.ilike.%interested%,notes.ilike.%response%")
      .neq("status", "closed_won")
      .neq("status", "closed_lost")
      .limit(20);

    if (hotLeads?.length) {
      alerts.push(`<h3 style="color:#f59e0b;">🔥 ${hotLeads.length} HOT LEADS (replied/interested)</h3>
        <ul>${hotLeads.map(l => `<li><strong>${l.business_name}</strong> (${l.city}) — ${l.status}<br/><em>${(l.notes || "").slice(0, 100)}</em></li>`).join("")}</ul>
        <p style="color:#f97316;font-weight:bold;">⚡ These need follow-up TODAY</p>`);
    }

    // 2. Stale leads — in drip but no activity in 14+ days
    const staleDate = new Date(now.getTime() - 14 * 86400000).toISOString();
    const { data: staleLeads } = await sb
      .from("web_design_leads")
      .select("id, business_name, email, city, status, updated_at")
      .in("status", ["new", "contacted", "drip"])
      .lt("updated_at", staleDate)
      .limit(20);

    if (staleLeads?.length) {
      alerts.push(`<h3 style="color:#fb923c;">⏳ ${staleLeads.length} STALE LEADS (14+ days no activity)</h3>
        <ul>${staleLeads.map(l => `<li>${l.business_name} (${l.city}) — last touch: ${new Date(l.updated_at).toLocaleDateString()}</li>`).join("")}</ul>`);
    }

    // 3. Pipeline summary
    const { data: pipeline } = await sb
      .from("web_design_leads")
      .select("status");

    const counts: Record<string, number> = {};
    pipeline?.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });

    const pipelineHtml = `<h3>📊 Pipeline Snapshot</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${Object.entries(counts).map(([s, c]) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #334155;">${s}</td><td style="text-align:right;padding:4px 8px;border-bottom:1px solid #334155;font-weight:bold;">${c}</td></tr>`).join("")}
        <tr><td style="padding:4px 8px;font-weight:bold;color:#22d3ee;">TOTAL</td><td style="text-align:right;padding:4px 8px;font-weight:bold;color:#22d3ee;">${pipeline?.length || 0}</td></tr>
      </table>`;

    // 4. Recent prospecting activity (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const { count: newLeadsThisWeek } = await sb
      .from("web_design_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    // 5. Check suppressed list size
    const { count: suppressedCount } = await sb
      .from("suppressed_emails")
      .select("id", { count: "exact", head: true });

    const summaryHtml = `
      <h3>📈 This Week's Activity</h3>
      <p>New leads found: <strong>${newLeadsThisWeek || 0}</strong></p>
      <p>Suppressed emails: <strong>${suppressedCount || 0}</strong></p>
    `;

    // Only email if there's something to report
    if (alerts.length > 0 || (pipeline?.length || 0) > 0) {
      await sendTomEmail(
        `🎯 Tom Daily: ${hotLeads?.length || 0} hot, ${staleLeads?.length || 0} stale, ${newLeadsThisWeek || 0} new`,
        alerts.join("") + pipelineHtml + summaryHtml
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      hot_leads: hotLeads?.length || 0,
      stale_leads: staleLeads?.length || 0,
      pipeline_total: pipeline?.length || 0,
      new_this_week: newLeadsThisWeek || 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[TOM]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
