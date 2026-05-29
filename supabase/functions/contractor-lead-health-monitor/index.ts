// Health monitor — runs every 30 min via cron
// Alerts Matt if any contractor lead has been sitting unnotified for > 30 minutes
// This catches failures in both contractor-lead-capture and contractor-lead-notify

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Find leads older than 30 min that still haven't been notified
    const { data: stuckLeads } = await sb
      .from("contractor_leads")
      .select("id, name, phone, email, project_type, created_at, site_id")
      .eq("status", "new")
      .is("notified_at", null)
      .lte("created_at", thirtyMinAgo);

    if (!stuckLeads || stuckLeads.length === 0) {
      return new Response(JSON.stringify({ stuck: 0, alerted: false }), { status: 200 });
    }

    console.log(`[LEAD-HEALTH] ⚠ ${stuckLeads.length} leads stuck without notification!`);

    // Build a summary of stuck leads
    const leadSummary = stuckLeads.map((l) => {
      const age = Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000);
      return `• ${l.name} — ${l.phone} (${age} min ago)`;
    }).join("<br>");

    // Alert Matt immediately
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System Alert <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `⚠ ${stuckLeads.length} contractor lead(s) NOT delivered!`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;border:2px solid #dc2626;overflow:hidden;">
  <div style="background:#dc2626;padding:12px 24px;color:#fff;font-weight:700;font-size:16px;">
    ⚠ LEAD DELIVERY FAILURE
  </div>
  <div style="padding:24px;font-size:15px;color:#1e293b;line-height:1.8;">
    <p><strong>${stuckLeads.length} lead(s)</strong> have been waiting 30+ minutes without notification to the contractor:</p>
    <p>${leadSummary}</p>
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:13px;color:#64748b;">This means the contractor-lead-notify cron may have failed, or no contractor is assigned to the territory. Check the Supabase dashboard immediately.</p>
    <p style="font-size:13px;color:#dc2626;font-weight:bold;">Action: Call these leads yourself or manually forward to the contractor.</p>
  </div>
</div>
</body></html>`,
        }),
      });

      console.log(`[LEAD-HEALTH] Alert email sent to Matt — ${stuckLeads.length} stuck leads`);
    }

    return new Response(JSON.stringify({ stuck: stuckLeads.length, alerted: true }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEAD-HEALTH] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
