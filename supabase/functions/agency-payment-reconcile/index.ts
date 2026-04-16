// Daily 11pm ET — diff Stripe payment_intent.succeeded vs agency_candidate_assignments.charged_at
// Patches gaps, SMS Matt on any discrepancy.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const adminPhone = Deno.env.get("ADMIN_PHONE");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  const since = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000);
  const patched: string[] = [];
  const orphans: string[] = [];

  try {
    // List succeeded intents in past 24h
    const intents = await stripe.paymentIntents.list({ created: { gte: since }, limit: 100 });
    for (const intent of intents.data) {
      if (intent.status !== "succeeded") continue;
      if (intent.metadata?.type !== "agency_interview_charge") continue;
      const assignmentId = intent.metadata?.assignment_id;
      if (!assignmentId) {
        orphans.push(intent.id);
        continue;
      }
      const { data: a } = await sb
        .from("agency_candidate_assignments")
        .select("id, charged_at, stripe_charge_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (!a) {
        orphans.push(`${intent.id} (no assignment ${assignmentId})`);
        continue;
      }
      if (!a.charged_at || !a.stripe_charge_id) {
        await sb.from("agency_candidate_assignments").update({
          charged_at: new Date(intent.created * 1000).toISOString(),
          stripe_charge_id: intent.id,
          charge_amount_cents: intent.amount,
        }).eq("id", assignmentId);
        patched.push(assignmentId);
      }
    }

    // SMS Matt only if we found anything
    if ((patched.length || orphans.length) && adminPhone && twilioSid && twilioAuth && twilioFrom) {
      const msg = `🔧 Stripe reconcile: patched ${patched.length} assignment(s), ${orphans.length} orphan intent(s). ${orphans.length > 0 ? "Check logs." : ""}`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: adminPhone, From: twilioFrom, Body: msg }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, patched: patched.length, orphans: orphans.length, orphan_intents: orphans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
