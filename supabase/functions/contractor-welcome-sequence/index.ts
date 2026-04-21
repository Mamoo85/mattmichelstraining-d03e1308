// contractor-welcome-sequence — fired by stripe-webhook on contractor_lead_subscription
// Sends 3 welcome SMS over 7 days to set expectations + reinforce trust.
// T+5min = welcome + dashboard link, T+72h = status, T+7d = first recap.
//
// IDEMPOTENCY: every attempt is logged to contractor_welcome_log with a partial
// unique index on (contractor_id, message_index) where status IN
// ('queued','sent','delivered'). A second invocation for the same slot returns
// 200 + { duplicate: true } and does NOT re-text the contractor.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { contractor_id, message_index = 0, attempted_by = "system" } = body;

    if (!contractor_id) {
      return new Response(JSON.stringify({ error: "contractor_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: c } = await sb
      .from("contractor_clients" as any)
      .select("id, business_name, phone, trade, city, roi_token, free_dead_leads_quota, active, stripe_customer_id, onboarded_at")
      .eq("id", contractor_id)
      .maybeSingle();

    // Guardrail: contractor_clients row must exist (Stripe webhook creates it)
    if (!c) {
      return new Response(JSON.stringify({
        error: "no_contractor_row",
        message: "No contractor_clients row exists yet. Stripe webhook (contractor_lead_subscription) creates this row on successful checkout. Welcome SMS will not fire until payment clears.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Guardrail: must be Stripe-provisioned (active + has stripe_customer_id)
    if (!(c as any).stripe_customer_id) {
      return new Response(JSON.stringify({
        error: "not_stripe_provisioned",
        message: "Contractor row exists but has no stripe_customer_id. Likely a manual insert or test record — welcome SMS blocked to prevent sending to unpaid prospects.",
      }), { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((c as any).active === false) {
      return new Response(JSON.stringify({
        error: "contractor_inactive",
        message: "Contractor row is marked inactive. Welcome SMS blocked.",
      }), { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!c?.phone) {
      return new Response(JSON.stringify({
        error: "phone_missing",
        message: "Contractor row exists and is paid, but phone is missing. Cannot send SMS.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const idx = Math.max(0, Math.min(2, Number(message_index)));

    // ── IDEMPOTENCY GUARD ─────────────────────────────────────────────────
    // Reserve the (contractor_id, message_index) slot BEFORE sending.
    // Partial unique index blocks any duplicate where status IN
    // ('queued','sent','delivered'). On conflict → already sent → return 200.
    const { data: reserveRow, error: reserveErr } = await sb
      .from("contractor_welcome_log" as any)
      .insert({
        contractor_id,
        message_index: idx,
        status: "queued",
        recipient_phone: c.phone,
        attempted_by,
      })
      .select("id")
      .maybeSingle();

    if (reserveErr) {
      // 23505 = unique violation → slot already reserved/sent
      const code = (reserveErr as any).code || "";
      if (code === "23505" || /duplicate key/i.test(reserveErr.message || "")) {
        // Look up existing row so admin can see status
        const { data: existing } = await sb
          .from("contractor_welcome_log" as any)
          .select("id, status, twilio_sid, twilio_status, created_at")
          .eq("contractor_id", contractor_id)
          .eq("message_index", idx)
          .in("status", ["queued", "sent", "delivered"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return new Response(JSON.stringify({
          ok: true,
          duplicate: true,
          message: `Welcome message #${idx + 1} already attempted for this contractor.`,
          existing,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Other DB error — log and continue with send (don't block on log failure)
      console.error("[contractor-welcome-sequence] reserve insert failed:", reserveErr);
    }

    const reserveId = (reserveRow as any)?.id || null;

    const trade = ((c as any).trade || "service").toLowerCase();
    const city = (c as any).city || "your area";
    const portalUrl = `https://detroitwebagent.com/contractor-portal/${(c as any).roi_token || contractor_id}`;
    const intakeUrl = `https://detroitwebagent.com/dead-lead-intake?cid=${contractor_id}`;
    const statusUrl = `https://detroitwebagent.com/contractor-onboarding-status?contractor_id=${contractor_id}`;
    const quota = (c as any).free_dead_leads_quota || 40;

    const messages = [
      // T+5min — welcome + free boost CTA + activation status link
      `Welcome to DWA. Your ${trade} lead system is LIVE in ${city}. FREE BOOST: paste up to ${quota} old quotes here for free SMS reactivation while Google ads warm up (3-5 days): ${intakeUrl}\n\nDashboard: ${portalUrl}\nActivation status: ${statusUrl}\n— Matt (313) 992-1219`,
      // T+72h — status
      `${(c as any).business_name || "Hey"} — Day 3 update: your landing page is live + Google ads launching today. The 'priming period' takes 3-5 days. Dashboard: ${portalUrl}`,
      // T+7d — first recap
      `Week 1 recap is ready in your dashboard — leads delivered, free boost progress, lead probability %. View: ${portalUrl}`,
    ];

    const msg = messages[idx];

    const result = await sendSMS(c.phone, TWILIO_PHONE_NUMBER, msg, "contractor_welcome");

    // Update the reserved log row with the result
    if (reserveId) {
      await sb
        .from("contractor_welcome_log" as any)
        .update({
          status: result.success ? "sent" : (result.skipped ? "skipped" : "failed"),
          twilio_sid: result.sid || null,
          twilio_status: result.success ? "queued" : null,
          error_message: result.error || null,
          body_preview: msg.slice(0, 200),
        })
        .eq("id", reserveId);
    }

    return new Response(JSON.stringify({
      ok: result.success,
      sent: idx,
      phone: c.phone,
      twilio_sid: result.sid,
      log_id: reserveId,
      error: result.error,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[contractor-welcome-sequence] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
