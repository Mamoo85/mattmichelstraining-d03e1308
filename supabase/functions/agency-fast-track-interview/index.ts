import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

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

    // 3. ATOMIC credit burn via RPC — prevents simultaneous-click bypass
    let chargeId: string | null = null;
    let chargeError: string | null = null;
    let creditBurned = false;

    const { data: burnResult } = await supabase.rpc("burn_fast_track_credit", { p_agency_id: agency_id });
    creditBurned = burnResult === true;

    if (!creditBurned && agency.pricing_model === "performance" && agency.stripe_customer_id && agency.stripe_payment_method_id) {
      // 4. Charge $250 — record DB FIRST, then refund on DB failure
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
      try {
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
          idempotencyKey: `fast-track-${assignment_id}`,
        });
        chargeId = intent.id;

        // Record charge in DB — if this fails, refund Stripe to avoid double-bill on retry
        const { error: dbErr } = await supabase.from("agency_candidate_assignments").update({
          charged_at: new Date().toISOString(),
          charge_amount_cents: agency.per_interview_fee_cents || 25000,
          stripe_charge_id: chargeId,
        }).eq("id", assignment_id);

        if (dbErr) {
          console.error("[fast-track] DB write failed after charge — refunding:", dbErr);
          try {
            await stripe.refunds.create(
              { payment_intent: chargeId, reason: "duplicate" },
              { idempotencyKey: `fast-track-refund-${assignment_id}` }
            );
            chargeError = `db_write_failed_refunded: ${dbErr.message}`;
            chargeId = null;
          } catch (refundErr) {
            chargeError = `db_write_failed_refund_failed: ${dbErr.message} / ${String(refundErr)}`;
          }
        }
      } catch (e) {
        chargeError = e instanceof Error ? e.message : String(e);
      }
    }

    // 5. Notify Matt via shared sendSMS (TCPA + sinkhole compliant)
    if (TWILIO_FROM) {
      let msg: string;
      const prefix = agency.is_test_account ? "[TEST SINKHOLE] " : "";
      if (creditBurned) {
        msg = `${prefix}⚡ ${agency.agency_name} booked interview · ghost-credit burned (free)`;
      } else if (chargeId) {
        msg = `${prefix}⚡ ${agency.agency_name} booked interview · $${((agency.per_interview_fee_cents || 25000) / 100).toFixed(0)} charged`;
      } else {
        msg = `${prefix}⚡ ${agency.agency_name} booked interview · ${chargeError ? "CHARGE FAILED — invoice manually" : "no charge (territory_lock or no card)"}`;
      }
      try {
        await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "dwa_admin_reply");
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
