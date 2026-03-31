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

const PLAN_CONFIG: Record<string, { amount: number; label: string; description: string; successRoute: string }> = {
  standard: {
    amount: 19900,
    label: "Standard (Facebook + LinkedIn, 3 posts/week)",
    description: "AI-written posts published to Facebook and LinkedIn 3x per week. Branded to your business, no scheduling apps needed.",
    successRoute: "/social-media-ai",
  },
  pro: {
    amount: 29900,
    label: "Pro (Facebook + LinkedIn + Instagram + GBP, 5 posts/week)",
    description: "Everything in Standard plus Instagram and Google Business Profile posting, 5 posts/week, and a monthly analytics report.",
    successRoute: "/social-media-ai",
  },
  trainer: {
    amount: 14900,
    label: "Trainer Social AI (3 posts/week)",
    description: "AI-generated fitness and nutrition content in your brand voice, posted to your social channels 3x per week.",
    successRoute: "/trainer-social-ai",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      email,
      name,
      business_name,
      business_type,
      city,
      state,
      plan = "standard",
      platforms = [],
    } = await req.json();

    if (!email || !business_name) {
      return new Response(
        JSON.stringify({ error: "email and business_name are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const planCfg = PLAN_CONFIG[plan];
    if (!planCfg) {
      return new Response(
        JSON.stringify({ error: `Unknown plan: ${plan}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const platformsArr = Array.isArray(platforms) ? platforms : [];
    const platformsStr = platformsArr.join(",");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert pending client record
    const { data: client } = await sb
      .from("social_media_clients")
      .insert({
        business_name,
        business_type: business_type || null,
        contact_name: name || null,
        email,
        city: city || null,
        state: state || null,
        platforms: platformsArr,
        plan,
        active: false,
      })
      .select()
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: planCfg.amount,
            product_data: {
              name: `M² Social Media AI — ${planCfg.label}`,
              description: planCfg.description,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "social_media_subscription",
        email,
        business_name,
        plan,
        platforms: platformsStr,
        client_id: client?.id || "",
      },
      success_url: `${origin}${planCfg.successRoute}?success=1`,
      cancel_url: `${origin}${planCfg.successRoute}`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `New Social Media AI signup — ${business_name} (${plan})`,
          html: `<p><strong>${business_name}</strong> started checkout for the ${planCfg.label} plan at $${(planCfg.amount / 100).toFixed(0)}/month.<br>
Contact: ${name || "n/a"} — ${email}<br>
${city || ""}${state ? ", " + state : ""}${business_type ? " — " + business_type : ""}<br>
Platforms: ${platformsArr.length ? platformsArr.join(", ") : "none selected"}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-SOCIAL-MEDIA-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
