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
    const { email, name, niche = "dental" } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: corsHeaders });

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const nicheLabels: Record<string, string> = {
      dental: "Dental & Orthodontic Practices",
      hvac: "HVAC & Mechanical Contractors",
      pt: "Physical Therapy & Chiropractic Offices",
      auto: "Independent Auto Repair Shops",
      industrial: "Industrial Suppliers & Manufacturers",
    };
    const nicheLabel = nicheLabels[niche] || "Business Contacts";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: niche === "industrial" ? 9900 : 14900,
          product_data: {
            name: `M² B2B Lead Database — ${nicheLabel}`,
            description: `Searchable, filterable database of verified ${nicheLabel.toLowerCase()} across the Midwest. ${niche === "industrial" ? "Updated weekly" : "Updated daily"}. Export to CSV anytime.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "b2b_database_subscription",
        niche,
        customer_name: name || "",
      },
      success_url: `${origin}/b2b-leads?success=1`,
      cancel_url: `${origin}/b2b-leads`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"],
          subject: `New B2B database subscriber — ${email}`,
          html: `<p><strong>${name || email}</strong> started checkout for the ${nicheLabel} database at $149/month.<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[CREATE-B2B-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
