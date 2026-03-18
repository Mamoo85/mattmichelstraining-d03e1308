import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { slot_date, start_time, duration_minutes, session_type = "in_person" } = await req.json();
    if (!slot_date || !start_time || ![30, 60].includes(duration_minutes)) {
      throw new Error("Invalid request");
    }

    // Check slot availability
    const timesToCheck = [start_time];
    if (duration_minutes === 60) {
      const [h, m] = start_time.split(":").map(Number);
      const total = h * 60 + m + 30;
      timesToCheck.push(`${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}:00`);
    }

    const { data: slotsData } = await supabaseAdmin
      .from("schedule_slots")
      .select("*")
      .eq("slot_date", slot_date)
      .in("start_time", timesToCheck)
      .eq("is_available", true)
      .is("booked_by", null);

    if (!slotsData || slotsData.length < timesToCheck.length) {
      throw new Error("One or more selected slots are no longer available");
    }

    // Check 2.5 hour cutoff
    const slotDateTime = new Date(`${slot_date}T${start_time}`);
    if (slotDateTime.getTime() - Date.now() < 2.5 * 60 * 60 * 1000) {
      throw new Error("Slots must be booked at least 2.5 hours in advance");
    }

    const amountCents = duration_minutes === 60 ? 9000 : 5000;
    const label = duration_minutes === 60 ? "M² Training Session — 1 Hour" : "M² Training Session — 30 Min";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    // Get user profile for name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, athlete_name")
      .eq("user_id", user.id)
      .single();

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/schedule?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/schedule`,
      metadata: {
        type: "training_session",
        user_id: user.id,
        user_email: user.email,
        user_name: profile?.full_name || profile?.athlete_name || "",
        slot_date,
        start_time,
        duration_minutes: String(duration_minutes),
        slot_ids: JSON.stringify(slotsData.map((s: any) => s.id)),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
