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
    const { email, name, business_name, phone, trade, city, state = "MI", plan = "standard" } = await req.json();

    if (!email || !trade || !city) {
      return new Response(JSON.stringify({ error: "email, trade, and city are required" }), { status: 400, headers: corsHeaders });
    }

    // Price: $399/month standard, $299/month for smaller markets
    const smallMarkets = ["ann arbor", "grand rapids", "lansing", "flint", "kalamazoo"];
    const isSmall = smallMarkets.some(m => city.toLowerCase().includes(m));
    const monthlyPrice = isSmall ? 29900 : 39900;
    const tradeLabel = trade.charAt(0).toUpperCase() + trade.slice(1);
    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert pending contractor record
    const { data: contractor } = await sb
      .from("contractor_clients")
      .insert({ name, business_name, email, phone, trade, city, state })
      .select()
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price: "price_1THQqsD52tPWee46ri58gzXf",
          unit_amount: monthlyPrice,
          product_data: {
            name: `Exclusive ${tradeLabel} Leads — ${city}, ${state}`,
            description: `All exclusive ${tradeLabel.toLowerCase()} leads in ${city} routed directly to you. No shared leads. Cancel anytime.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "contractor_lead_subscription",
        trade,
        city,
        state,
        contractor_id: contractor?.id || "",
        business_name: business_name || name,
      },
      success_url: `${origin}/contractor-signup?success=1&trade=${encodeURIComponent(trade)}&city=${encodeURIComponent(city)}`,
      cancel_url: `${origin}/contractor-signup`,
    });

    // Email Matt about new contractor signup attempt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `New contractor checkout — ${tradeLabel} in ${city}`,
          html: `<p>Contractor started checkout:<br><strong>${business_name || name}</strong><br>${email} | ${phone || "no phone"}<br>Trade: ${trade} | City: ${city}, ${state}<br>Monthly: $${(monthlyPrice / 100).toFixed(0)}/mo<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-CONTRACTOR-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
