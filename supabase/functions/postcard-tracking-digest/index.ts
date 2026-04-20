/**
 * postcard-tracking-digest
 * Daily 8am ET email summary of postcard activity.
 * Reports: in transit, delivered yesterday, returned, conversions, cost-per-acquisition.
 * Skips entirely if no activity.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // Fetch all active counters in parallel
    const [inTransitR, deliveredR, returnedR, failedR, conversionsR, campaignsR] = await Promise.all([
      sb.from("postcard_send_log").select("id", { count: "exact", head: true }).in("delivery_status", ["in_transit", "processed", "queued", "rendered"]),
      sb.from("postcard_send_log").select("id, business_name, city, delivered_at", { count: "exact" }).eq("delivery_status", "delivered").gte("delivered_at", yesterday),
      sb.from("postcard_send_log").select("id, business_name, city", { count: "exact" }).eq("delivery_status", "returned").gte("sent_at", yesterday),
      sb.from("postcard_send_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("sent_at", yesterday),
      sb.from("postcard_conversions").select("id, county, event").gte("created_at", yesterday),
      sb.from("postcard_campaigns").select("id, county, audience_type, sent_count, delivered_count, returned_count, total_cost_cents").gt("sent_count", 0),
    ]);

    const inTransit = inTransitR.count || 0;
    const deliveredYesterday = deliveredR.count || 0;
    const returnedYesterday = returnedR.count || 0;
    const failedYesterday = failedR.count || 0;
    const conversionsYesterday = conversionsR.data?.length || 0;
    const paidConversions = conversionsR.data?.filter((c: any) => c.event === "paid").length || 0;

    // Skip if zero activity
    if (inTransit === 0 && deliveredYesterday === 0 && returnedYesterday === 0 && failedYesterday === 0 && conversionsYesterday === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no activity" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaigns = campaignsR.data || [];
    const totalCostDollars = (campaigns.reduce((s: number, c: any) => s + (c.total_cost_cents || 0), 0) / 100).toFixed(2);
    const cpa = paidConversions > 0 ? (Number(totalCostDollars) / paidConversions).toFixed(2) : "—";

    // Build campaign breakdown rows (only campaigns with sends)
    const campaignRows = campaigns.map((c: any) => {
      const sent = c.sent_count || 0;
      const delivered = c.delivered_count || 0;
      const returned = c.returned_count || 0;
      const inFlight = Math.max(0, sent - delivered - returned);
      const cost = ((c.total_cost_cents || 0) / 100).toFixed(2);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;">${c.county || "—"} · <span style="color:#64748b;font-size:11px;">${c.audience_type || ""}</span></td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;text-align:right;">${sent}</td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;text-align:right;color:#fbbf24;">${inFlight}</td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;text-align:right;color:#10b981;">${delivered}</td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;text-align:right;color:#f87171;">${returned}</td>
        <td style="padding:8px;border-bottom:1px solid #1e3a5f;text-align:right;">$${cost}</td>
      </tr>`;
    }).join("");

    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px;max-width:680px;margin:0 auto;">
      <h1 style="color:#00d4ff;font-size:22px;margin:0 0 4px;">📮 Postcard Tracking Digest</h1>
      <p style="color:#64748b;font-size:12px;margin:0 0 24px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:8px;padding:14px;">
          <div style="color:#fbbf24;font-size:24px;font-weight:800;">${inTransit}</div>
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">In Transit</div>
        </div>
        <div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:8px;padding:14px;">
          <div style="color:#10b981;font-size:24px;font-weight:800;">${deliveredYesterday}</div>
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Delivered (24h)</div>
        </div>
        <div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:8px;padding:14px;">
          <div style="color:#f87171;font-size:24px;font-weight:800;">${returnedYesterday}</div>
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Returned (24h)</div>
        </div>
        <div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:8px;padding:14px;">
          <div style="color:#00d4ff;font-size:24px;font-weight:800;">${paidConversions}</div>
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Paid Conversions (24h)</div>
        </div>
      </div>

      <div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Cost per acquisition (lifetime)</div>
        <div style="color:#fff;font-size:18px;font-weight:700;">$${cpa} <span style="color:#64748b;font-size:13px;font-weight:400;">· $${totalCostDollars} spent / ${paidConversions} paid</span></div>
      </div>

      ${campaignRows ? `<h2 style="color:#fff;font-size:16px;margin:24px 0 8px;">Per-Campaign Breakdown</h2>
      <table style="width:100%;border-collapse:collapse;background:#0f2342;border-radius:8px;overflow:hidden;font-size:12px;">
        <thead><tr style="background:#1e3a5f;color:#94a3b8;font-size:10px;text-transform:uppercase;">
          <th style="padding:8px;text-align:left;">Campaign</th>
          <th style="padding:8px;text-align:right;">Sent</th>
          <th style="padding:8px;text-align:right;">In Flight</th>
          <th style="padding:8px;text-align:right;">Delivered</th>
          <th style="padding:8px;text-align:right;">Returned</th>
          <th style="padding:8px;text-align:right;">Cost</th>
        </tr></thead>
        <tbody>${campaignRows}</tbody>
      </table>` : ""}

      ${failedYesterday > 0 ? `<p style="color:#f87171;font-size:13px;margin-top:20px;">⚠️ ${failedYesterday} sends failed in the last 24h. Check the Send Log in /dwa-admin → Postcard Ops.</p>` : ""}

      <p style="color:#64748b;font-size:11px;margin-top:32px;border-top:1px solid #1e3a5f;padding-top:12px;">
        Lob delivery confirmations typically arrive 5-12 days after mailing. Numbers above reflect actual webhook events from Lob.
      </p>
    </div>`;

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "DWA Postcard Tracking <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `📮 Postcards: ${inTransit} in transit · ${deliveredYesterday} delivered · ${paidConversions} paid (24h)`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      in_transit: inTransit,
      delivered_24h: deliveredYesterday,
      returned_24h: returnedYesterday,
      failed_24h: failedYesterday,
      paid_conversions_24h: paidConversions,
      cpa,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
