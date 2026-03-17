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

    // Deduct gift card if used
    const giftCardId = session.metadata?.gift_card_id;
    const giftCardApplied = parseFloat(session.metadata?.gift_card_applied || "0");
    if (giftCardId && giftCardApplied > 0) {
      const { data: currentCard } = await supabaseClient
        .from("gift_cards")
        .select("remaining_balance")
        .eq("id", giftCardId)
        .single();

      if (currentCard) {
        const newBalance = Math.max(0, currentCard.remaining_balance - giftCardApplied);
        await supabaseClient.from("gift_cards").update({
          remaining_balance: newBalance,
          is_active: newBalance > 0,
          redeemed_by: user.id,
          redeemed_at: new Date().toISOString(),
        }).eq("id", giftCardId);
        logStep("Gift card deducted", { applied: giftCardApplied, newBalance });
      }
    }

    // Insert into user_active_programs
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

    // Get program title and user email
    const { data: program } = await supabaseClient
      .from("training_programs")
      .select("title")
      .eq("id", programId)
      .single();

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    const programTitle = program?.title || "Your program";

    // Create notification
    await supabaseClient.from("notifications").insert({
      user_id: user.id,
      type: "program_purchased",
      title: "Program Activated!",
      body: `${programTitle} is now loaded in your portal. Head to My Programs to start training.`,
      link: "/dashboard",
    });

    // Send welcome email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && profile?.email) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@m2training.lovable.app>",
            to: [profile.email],
            subject: `Welcome to ${programTitle}. Here's step one.`,
            html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1a1a1a; line-height: 1.7;">
  <p style="font-size: 18px; font-weight: bold; margin-bottom: 24px;">You're in.</p>
  <p>Your program, <strong>${programTitle}</strong>, is locked and loaded in your M² Client Portal.</p>
  <p>I don't give busy work. Every movement in this program is there to rebuild your mechanics, bulletproof your joints, and build real strength.</p>
  <p style="font-weight: bold; margin-top: 28px;">Here is exactly what I need you to do next:</p>
  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 12px;"><strong>Log into your portal</strong> and pull up Week 1, Day 1.</li>
    <li style="margin-bottom: 12px;"><strong>Read 'The Why'</strong> under the exercises. If you understand why we are doing it, you will do it better.</li>
    <li style="margin-bottom: 12px;"><strong>Do the work.</strong></li>
    <li style="margin-bottom: 12px;"><strong>Use the 'Flag Coach Matt' button.</strong> If a movement feels off, or you want me to check your form, record a quick video on your phone and upload it to the workout log. I will review it and get back to you with corrections.</li>
  </ol>
  <p style="margin-top: 28px;">Don't overthink it. Just execute Day 1.</p>
  <p style="margin-top: 28px;">Talk soon,</p>
  <p style="margin-bottom: 4px;"><strong>Matt Michels</strong></p>
  <p style="color: #888; font-size: 13px; margin-top: 0;">M² Training</p>
</div>`,
          }),
        });
        const emailData = await emailRes.json();
        logStep("Welcome email sent", emailData);
      } catch (emailErr) {
        logStep("Welcome email failed (non-fatal)", { error: String(emailErr) });
      }
    }

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
