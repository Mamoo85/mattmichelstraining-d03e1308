import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await sb.auth.getUser(token);
    if (!userData?.user) throw new Error("Not authenticated");

    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .limit(1);
    if (!roleData || roleData.length === 0) throw new Error("Not authorized");

    const { transaction_id, subscription_id, customer_email } = await req.json();
    if (!subscription_id && !customer_email) throw new Error("Missing subscription_id or customer_email");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let subId = subscription_id;

    // If no subscription ID, look it up by customer email
    if (!subId && customer_email) {
      const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({
          customer: customers.data[0].id,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) {
          subId = subs.data[0].id;
        }
      }
    }

    if (!subId) throw new Error("No active subscription found");

    // Cancel immediately
    const cancelled = await stripe.subscriptions.cancel(subId);
    console.log(`[CANCEL] Subscription cancelled: ${subId}`);

    // Downgrade profile to free
    if (customer_email) {
      await sb.from("profiles")
        .update({ subscription_tier: "free" })
        .eq("email", customer_email);
    }

    // Update transaction status
    if (transaction_id) {
      await sb.from("transactions").update({ status: "cancelled" }).eq("id", transaction_id);
    }

    return new Response(JSON.stringify({ success: true, status: cancelled.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CANCEL] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
