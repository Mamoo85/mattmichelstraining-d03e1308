// Cron-triggered function: checks for unnotified leads every 15 minutes.
// Subscription contractors: full contact info via SMS + email immediately.
// PPL contractors (no active subscription): FOMO teaser SMS with $50 claim link.
// Also releases expired soft locks so leads become available again.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const SITE_URL = "https://www.detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Release expired soft locks so leads become available again
    await sb.from("contractor_leads")
      .update({ status: "new", checkout_locked_by: null, lock_expires_at: null })
      .eq("status", "pending_checkout")
      .lt("lock_expires_at", new Date().toISOString());

    // Find leads created in last 24h that haven't been notified
    const { data: unnotified } = await sb
      .from("contractor_leads")
      .select(`
        id, name, phone, email, message, project_type, created_at,
        site_id,
        contractor_lead_sites (trade, city, state, slug, active_contractor_id)
      `)
      .eq("status", "new")
      .is("notified_at", null)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!unnotified || unnotified.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let count = 0;
    for (const lead of unnotified) {
      const site = (lead as any).contractor_lead_sites;

      if (!site?.active_contractor_id) {
        console.log(`[LEAD-NOTIFY] No active contractor for lead ${lead.id}, skipping`);
        continue;
      }

      const { data: contractor } = await sb
        .from("contractor_clients")
        .select("id, name, business_name, email, phone, active")
        .eq("id", site.active_contractor_id)
        .maybeSingle();

      if (!contractor) {
        console.log(`[LEAD-NOTIFY] Contractor ${site.active_contractor_id} not found for lead ${lead.id}, skipping`);
        continue;
      }

      const isActiveSubscriber = contractor.active === true;

      if (isActiveSubscriber) {
        // ── SUBSCRIPTION CONTRACTOR: full contact info ──────────────────────
        if (contractor.email && RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Detroit Web Agency <matt@detroitwebagent.com>",
              to: [contractor.email],
              bcc: ["matt@detroitwebagent.com"],
              subject: `New ${site?.trade || "service"} lead — ${lead.name}`,
              html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#00d4ff;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p><strong>🔥 New ${site?.trade || "service"} lead — exclusive to you.</strong></p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Name</td><td style="padding:8px 0;font-weight:600;">${lead.name}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:8px 0;font-weight:600;"><a href="tel:${lead.phone}" style="color:#00d4ff;">${lead.phone}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:8px 0;">${lead.email || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Project</td><td style="padding:8px 0;">${lead.project_type || "—"}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;">Call them fast — speed wins jobs.</p>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;">
      <strong>Matt Michels</strong> · Detroit Web Agency · (313) 806-4952
    </div>
  </div>
</div></body></html>`,
            }),
          });
        }

        if (contractor.phone) {
          const smsBody = `New ${site?.trade || "service"} lead for you: ${lead.name} — ${lead.phone}${lead.project_type ? ` (${lead.project_type})` : ""}. Exclusive — call now. — Matt (313) 806-4952`;
          await sendSMS(contractor.phone, TWILIO_PHONE, smsBody, "contractor_leads");
        }
      } else {
        // ── PPL CONTRACTOR: FOMO teaser — no contact info until paid ─────────
        if (contractor.phone) {
          // Build checkout URL — they tap it to claim for $50
          const claimUrl = `${SITE_URL}/claim-lead?lead_id=${lead.id}&contractor_id=${contractor.id}&email=${encodeURIComponent(contractor.email || "")}`;
          const smsBody = `🚨 HOT LEAD in ${site?.city || "Metro Detroit"}: ${lead.project_type || site?.trade || "service request"}.\nEXCLUSIVE — first contractor to claim it gets it.\n$50 unlocks name + phone + email:\n${claimUrl}`;
          await sendSMS(contractor.phone, TWILIO_PHONE, smsBody, "contractor_leads");
        }
      }

      // Mark as notified
      await sb.from("contractor_leads")
        .update({ notified_at: new Date().toISOString(), status: "notified" })
        .eq("id", lead.id);

      count++;
    }

    console.log(`[LEAD-NOTIFY] Sent ${count} notifications`);
    return new Response(JSON.stringify({ notified: count }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEAD-NOTIFY] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
