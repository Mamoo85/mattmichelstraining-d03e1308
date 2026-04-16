import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fast-Track Interview button handler. Called from /agency-portal.
 * Logs interview booking, charges $250 (performance tier), texts Matt.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignment_id, agency_id } = await req.json();
    if (!assignment_id || !agency_id) throw new Error("assignment_id and agency_id required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: agency } = await supabase
      .from("staffing_agency_clients")
      .select("*")
      .eq("id", agency_id)
      .single();
    if (!agency) throw new Error("Agency not found");

    const { data: assignment } = await supabase
      .from("agency_candidate_assignments")
      .select("*")
      .eq("id", assignment_id)
      .eq("agency_id", agency_id)
      .single();
    if (!assignment) throw new Error("Assignment not found");

    const updates: any = {
      status: "interview_booked",
      interview_booked_at: new Date().toISOString(),
    };

    let chargeId: string | null = null;
    let chargeError: string | null = null;

    // Charge $250 if performance tier + saved payment method
    if (agency.pricing_model === "performance" && agency.stripe_customer_id && agency.stripe_payment_method_id) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
        const intent = await stripe.paymentIntents.create({
          amount: agency.per_interview_fee_cents || 25000,
          currency: "usd",
          customer: agency.stripe_customer_id,
          payment_method: agency.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Fast-Track Interview · Assignment ${assignment_id.slice(0, 8)}`,
          metadata: { assignment_id, agency_id, type: "agency_interview_charge" },
        });
        chargeId = intent.id;
        updates.charged_at = new Date().toISOString();
        updates.charge_amount_cents = agency.per_interview_fee_cents || 25000;
        updates.stripe_charge_id = chargeId;
      } catch (e) {
        chargeError = String(e);
      }
    }

    await supabase.from("agency_candidate_assignments").update(updates).eq("id", assignment_id);

    // Notify Matt
    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (adminPhone && twilioSid && twilioAuth && twilioFrom) {
      const msg = chargeId
        ? `⚡ ${agency.agency_name} booked interview · $${((agency.per_interview_fee_cents || 25000) / 100).toFixed(0)} charged`
        : `⚡ ${agency.agency_name} booked interview · ${chargeError ? "CHARGE FAILED — invoice manually" : "no charge (territory_lock or no card)"}`;
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: adminPhone, From: twilioFrom, Body: msg }),
        });
      } catch (e) { console.error("SMS failed:", e); }
    }

    return new Response(JSON.stringify({
      ok: true,
      charged: !!chargeId,
      charge_id: chargeId,
      charge_error: chargeError,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
