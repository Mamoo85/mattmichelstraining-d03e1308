import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron 1st of month — flags performance agencies who paid >$2K last month
 * and emails Matt to flip them to $3,500/mo Territory Lock retainer.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const ADMIN_EMAIL = "matt@detroitwebagent.com";

  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const { data: agencies = [] } = await supabase
    .from("staffing_agency_clients")
    .select("*")
    .eq("active", true)
    .eq("pricing_model", "performance");

  const flips: any[] = [];
  for (const a of agencies || []) {
    const { data: charges = [] } = await supabase
      .from("agency_candidate_assignments")
      .select("charge_amount_cents")
      .eq("agency_id", a.id)
      .gte("charged_at", start.toISOString())
      .lt("charged_at", end.toISOString());
    const totalCents = (charges || []).reduce((s: number, r: any) => s + (r.charge_amount_cents || 0), 0);
    if (totalCents >= 200000) {
      flips.push({ agency: a, total: totalCents });
    }
  }

  if (flips.length && RESEND_API_KEY) {
    const rows = flips.map(f => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #1a2942;color:#e2e8f0;"><strong>${f.agency.agency_name}</strong><br><span style="color:#94a3b8;font-size:12px;">${f.agency.contact_name || ""} · ${f.agency.contact_email}</span></td>
        <td style="padding:12px;border-bottom:1px solid #1a2942;color:#00d4ff;font-size:18px;font-weight:600;">$${(f.total / 100).toFixed(0)}</td>
        <td style="padding:12px;border-bottom:1px solid #1a2942;color:#94a3b8;">${f.agency.vertical}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px;">
        <h1 style="color:#00d4ff;font-size:24px;margin:0 0 8px;">🎯 Flip-Ready Agencies</h1>
        <p style="color:#94a3b8;margin:0 0 24px;">${flips.length} agencies paid $2K+ last month — pitch them the $3,500/mo Territory Lock OR $25K annual prepay.</p>
        <table style="width:100%;border-collapse:collapse;background:#0f1f35;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#1a2942;">
            <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;">Agency</th>
            <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;">Last Mo Spend</th>
            <th style="padding:12px;text-align:left;color:#00d4ff;font-size:12px;">Vertical</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#64748b;font-size:12px;margin-top:32px;">Pitch script: "You spent $X last month on per-interview fees. Lock in $3,500/mo flat OR $25K annual prepay (saves $17K) for full territory exclusivity."</p>
      </div>
    </body></html>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: ADMIN_EMAIL,
        subject: `🎯 ${flips.length} agencies ready to flip to retainer`,
        html,
      }),
    });

    // Parallel SMS to Matt — flip alerts can't get buried in email
    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (adminPhone && twilioSid && twilioAuth && twilioFrom) {
      const top = flips.sort((a, b) => b.total - a.total)[0];
      const msg = flips.length === 1
        ? `🎯 FLIP READY: ${top.agency.agency_name} hit $${(top.total / 100).toFixed(0)} last month. Pitch $3,500/mo or $25K/yr lock.`
        : `🎯 ${flips.length} flip-ready agencies. Top: ${top.agency.agency_name} ($${(top.total / 100).toFixed(0)}). Check email for full list.`;
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: adminPhone, From: twilioFrom, Body: msg }),
        });
      } catch (e) { console.error("[agency-monthly-flip] SMS failed:", e); }
    }
  }

  return new Response(JSON.stringify({ ok: true, flips_found: flips.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
