import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const SITE = "https://www.mattmichelstraining.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { candidate_name, candidate_email, requester_email } = await req.json();

    if (!candidate_name || !candidate_email || !requester_email) {
      return new Response(
        JSON.stringify({ error: "candidate_name, candidate_email, and requester_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: requester_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 999,
            product_data: {
              name: "New Hire Credential Check",
              description: `Breach screen for ${candidate_name} (${candidate_email})`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "new_hire_breach_check",
        candidate_name,
        candidate_email,
        requester_email,
        is_test: "false",
      },
      success_url: `${SITE}/new-hire-check?success=true`,
      cancel_url: `${SITE}/new-hire-check`,
    });

    console.log(`[CREATE-NEW-HIRE-CHECK-CHECKOUT] Session created for ${requester_email}: ${session.id}`);
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-NEW-HIRE-CHECK-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
