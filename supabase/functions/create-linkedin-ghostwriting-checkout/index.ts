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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, industry, topics, tone } = await req.json();
    if (!email || !name) {
      return new Response(JSON.stringify({ error: "email and name are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create pending subscriber record
    await sb.from("linkedin_ghostwriting_clients").upsert(
      {
        email,
        name,
        industry: industry || "",
        topics: topics || "",
        tone: tone || "professional",
        active: false,
      },
      { onConflict: "email" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: 29900,
            product_data: {
              name: "LinkedIn Ghostwriting — 5 Posts Per Week",
              description:
                "AI-written LinkedIn posts delivered every Monday. Customized to your industry, voice, and topics. Cancel anytime.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "linkedin_ghostwriting_subscription",
        email,
        name,
        industry: industry || "",
      },
      success_url: `${origin}/linkedin-ghostwriting?success=1`,
      cancel_url: `${origin}/linkedin-ghostwriting`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@notify.m2training.com>",
          to: ["matt@m2training.com"],
          subject: `New LinkedIn Ghostwriting subscriber — ${email}`,
          html: `<p><strong>${name}</strong> (${email}) started checkout for LinkedIn Ghostwriting at $299/month.</p>
<p>Industry: ${industry || "Not specified"}<br>Tone: ${tone || "professional"}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[CREATE-LINKEDIN-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
