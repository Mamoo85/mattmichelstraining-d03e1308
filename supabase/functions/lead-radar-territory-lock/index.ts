// LR-16: Geographic territory lock — Stripe exclusive checkout
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contractor_id, contractor_email, county, trade } = await req.json();
    if (!contractor_id || !county || !trade) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if territory is already locked
    const { data: existing } = await supabase
      .from("radar_territory_locks" as any)
      .select("id, contractor_id")
      .eq("county", county)
      .eq("trade", trade)
      .eq("active", true)
      .maybeSingle();

    if (existing && (existing as any).contractor_id !== contractor_id) {
      return new Response(JSON.stringify({ error: `${county} ${trade} territory is already locked by another contractor.` }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: contractor_email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Exclusive Lead Territory: ${trade} in ${county} County`, description: "All qualifying leads in this territory routed exclusively to you" },
          unit_amount: 49900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      success_url: `${req.headers.get("origin")}/contractor-leads?territory_locked=1`,
      cancel_url: `${req.headers.get("origin")}/contractor-leads`,
      metadata: { type: "radar_territory_lock", contractor_id, county, trade },
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
