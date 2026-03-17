import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PROGRAM] ${step}${detailsStr}`);
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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Not authenticated");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const user = userData.user;
    const { sessionId, programId } = await req.json();
    if (!sessionId || !programId) throw new Error("sessionId and programId required");

    logStep("Verifying payment", { sessionId, programId, userId: user.id });

    // Check if already activated
    const { data: existing } = await supabaseClient
      .from("user_active_programs")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .limit(1);

    if (existing && existing.length > 0) {
      logStep("Program already activated");
      return new Response(JSON.stringify({ success: true, already_activated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verify the Stripe session
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Verify metadata matches
    if (session.metadata?.program_id !== programId || session.metadata?.user_id !== user.id) {
      throw new Error("Session does not match this program/user");
    }

    logStep("Payment verified, activating program");

    // Insert into user_active_programs (using service role)
    const { error: insertError } = await supabaseClient
      .from("user_active_programs")
      .insert({
        user_id: user.id,
        program_id: programId,
        stripe_session_id: sessionId,
        status: "active",
      });

    if (insertError) {
      logStep("Insert error", { message: insertError.message });
      throw new Error("Failed to activate program");
    }

    // Get program title for notification
    const { data: program } = await supabaseClient
      .from("training_programs")
      .select("title")
      .eq("id", programId)
      .single();

    // Create notification
    await supabaseClient.from("notifications").insert({
      user_id: user.id,
      type: "program_purchased",
      title: "Program Activated!",
      body: `${program?.title || "Your program"} is now loaded in your portal. Head to My Programs to start training.`,
      link: "/dashboard",
    });

    logStep("Program activated successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
