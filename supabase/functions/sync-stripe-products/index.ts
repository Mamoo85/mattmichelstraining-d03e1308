import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Admin access required");
    logStep("Admin verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all active programs missing Stripe IDs
    const { data: programs, error: progError } = await supabaseClient
      .from("training_programs")
      .select("id, title, description, price, level, sport, category")
      .eq("is_active", true)
      .is("stripe_product_id", null);

    if (progError) throw new Error(`DB error: ${progError.message}`);
    if (!programs || programs.length === 0) {
      return new Response(JSON.stringify({ message: "All programs already have Stripe products", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep(`Found ${programs.length} programs to sync`);

    const results: Array<{ id: string; title: string; stripeProductId: string; stripePriceId: string }> = [];
    const errors: Array<{ id: string; title: string; error: string }> = [];

    for (const prog of programs) {
      try {
        // Create Stripe product
        const product = await stripe.products.create({
          name: prog.title,
          description: prog.description || `${prog.level} interactive training program`,
          metadata: {
            program_id: prog.id,
            level: prog.level || "",
            sport: prog.sport || "",
            category: prog.category || "",
          },
        });

        // Create Stripe price (one-time)
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round((prog.price || 0) * 100),
          currency: "usd",
        });

        // Update DB
        await supabaseClient
          .from("training_programs")
          .update({
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            status: "published",
          })
          .eq("id", prog.id);

        results.push({
          id: prog.id,
          title: prog.title,
          stripeProductId: product.id,
          stripePriceId: price.id,
        });

        logStep(`Synced: ${prog.title}`, { productId: product.id, priceId: price.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ id: prog.id, title: prog.title, error: msg });
        logStep(`ERROR syncing ${prog.title}`, { error: msg });
      }
    }

    return new Response(JSON.stringify({
      synced: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("FATAL ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
