import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fast-Track Interview button handler — called from /agency-portal.
 *
 * Pipeline order (matters):
 *   1. Atomic collision lock — first agency to click wins; later clicks fail-fast.
 *   2. Burn ghost-credit if available (free interview) before charging Stripe.
 *   3. Charge $250 if performance tier + saved card AND no credit was burned.
 *   4. Notify Matt (sinkholed if agency.is_test_account).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignment_id, agency_id, demo } = await req.json();

    // Demo mode: hardcoded success, no DB writes, no Stripe
    if (demo === true || agency_id === "demo") {
      return new Response(JSON.stringify({
        ok: true,
        charged: false,
        demo: true,
        message: "Demo Mode — no charge, no SMS sent",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!assignment_id || !agency_id) throw new Error("assignment_id and agency_id required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Load agency + check test sinkhole flag
    const { data: agency } = await supabase
      .from("staffing_agency_clients")
      .select("*")
      .eq("id", agency_id)
      .single();
    if (!agency) throw new Error("Agency not found");

    // 2. ATOMIC COLLISION LOCK — only succeed if status is still 'delivered'
    //    (RETURNING gives us the row only if WHERE matched)
    const { data: lockedRows, error: lockErr } = await supabase
      .from("agency_candidate_assignments")
      .update({
        status: "interview_booked",
        interview_booked_at: new Date().toISOString(),
      })
      .eq("id", assignment_id)
      .eq("agency_id", agency_id)
      .eq("status", "delivered")
      .select("id, candidate_id");

    if (lockErr) throw lockErr;
    if (!lockedRows || lockedRows.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: "already_claimed",
        message: "Another agency claimed this candidate first.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const candidateId = lockedRows[0].candidate_id;

    // 2b. Collision-lock side effect: remove this candidate from OTHER agencies' feeds
    //     (only for performance-tier — territory_lock is already exclusive by county)
    await supabase
      .from("agency_candidate_assignments")
      .update({ status: "claimed_by_other", notes: `Claimed by ${agency.agency_name}` })
      .eq("candidate_id", candidateId)
      .eq("status", "delivered")
      .neq("agency_id", agency_id);

    // 3. Burn ghost credit if available (free interview)
    let chargeId: string | null = null;
    let chargeError: string | null = null;
    let creditBurned = false;

    if ((agency.fast_track_credits ?? 0) > 0) {
      await supabase
        .from("staffing_agency_clients")
        .update({ fast_track_credits: agency.fast_track_credits - 1 })
        .eq("id", agency_id);
      creditBurned = true;
    } else if (agency.pricing_model === "performance" && agency.stripe_customer_id && agency.stripe_payment_method_id) {
      // 4. Charge $250
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
        }, {
          // Idempotency: a webhook retry or duplicate request must never double-charge
          idempotencyKey: `fast-track-${assignment_id}`,
        });
        chargeId = intent.id;
        await supabase.from("agency_candidate_assignments").update({
          charged_at: new Date().toISOString(),
          charge_amount_cents: agency.per_interview_fee_cents || 25000,
          stripe_charge_id: chargeId,
        }).eq("id", assignment_id);
      } catch (e) {
        chargeError = String(e);
      }
    }

    // 5. Notify Matt (sinkhole if test account)
    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (adminPhone && twilioSid && twilioAuth && twilioFrom) {
      let msg: string;
      if (agency.is_test_account) {
        msg = `[TEST SINKHOLE] ${agency.agency_name} fast-track · ${creditBurned ? "credit burned" : chargeId ? "$250 charged" : "no charge"}`;
      } else if (creditBurned) {
        msg = `⚡ ${agency.agency_name} booked interview · ghost-credit burned (free)`;
      } else if (chargeId) {
        msg = `⚡ ${agency.agency_name} booked interview · $${((agency.per_interview_fee_cents || 25000) / 100).toFixed(0)} charged`;
      } else {
        msg = `⚡ ${agency.agency_name} booked interview · ${chargeError ? "CHARGE FAILED — invoice manually" : "no charge (territory_lock or no card)"}`;
      }
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
      credit_burned: creditBurned,
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
