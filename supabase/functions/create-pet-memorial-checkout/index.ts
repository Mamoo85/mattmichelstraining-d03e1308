import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const {
      pet_name,
      pet_species,
      pet_breed,
      pet_age,
      personality_traits,
      favorite_memories,
      special_message,
      customer_email,
      customer_name,
    } = await req.json();

    if (!customer_email || !pet_name) {
      return new Response(JSON.stringify({ error: "customer_email and pet_name are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 7900,
          product_data: { name: "AI Pet Memorial & Tribute" },
        },
        quantity: 1,
      }],
      metadata: {
        type: "pet_memorial",
        pet_name: pet_name || "",
        pet_species: pet_species || "",
        pet_breed: pet_breed || "",
        pet_age: pet_age || "",
        personality_traits: (personality_traits || "").slice(0, 500),
        favorite_memories: (favorite_memories || "").slice(0, 500),
        special_message: (special_message || "").slice(0, 500),
        customer_email: customer_email || "",
        customer_name: customer_name || "",
      },
      success_url: `${origin}/pet-memorial/success`,
      cancel_url: `${origin}/pet-memorial`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New Pet Memorial checkout — ${pet_name} (${customer_name || customer_email})`,
          html: `<p>New pet memorial started checkout:<br><strong>${customer_name || "Unknown"}</strong><br>${customer_email}<br>Pet: ${pet_name} (${pet_species || "species not listed"})<br>Amount: $79 one-time</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-PET-MEMORIAL-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
