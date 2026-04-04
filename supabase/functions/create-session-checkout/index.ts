import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { slot_date, start_time, duration_minutes, session_type = "in_person", guest_name, guest_email } = await req.json();
    if (!slot_date || !start_time || ![30, 60].includes(duration_minutes)) {
      throw new Error("Invalid request");
    }

    // Try to get authenticated user (optional)
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email || null;
        // Get profile name
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, athlete_name")
          .eq("user_id", userId)
          .single();
        userName = profile?.full_name || profile?.athlete_name || null;
      }
    }

    // If no authenticated user, require guest fields
    if (!userId) {
      if (!guest_name || !guest_email) {
        throw new Error("Name and email are required to book a session");
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email)) {
        throw new Error("Invalid email address");
      }
      userEmail = guest_email;
      userName = guest_name;
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

    // Look up or skip Stripe customer
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail!,
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
        user_id: userId || "guest",
        user_email: userEmail!,
        user_name: userName || "",
        slot_date,
        start_time,
        duration_minutes: String(duration_minutes),
        session_type,
        slot_ids: JSON.stringify(slotsData.map((s: any) => s.id)),
        is_guest: userId ? "false" : "true",
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
