// create-seo-audit-checkout — $49 one-time local SEO audit
// Input: { email, business_name, city?, website_url }
// Output: { url: stripe_checkout_session_url }
// On payment: stripe-webhook handles checkout.session.completed with type="seo_audit"
// and calls deliver-audit-report which scrapes the site + generates + emails the audit.
//
// Modeled on create-seo-package-checkout (same pattern, one-time $49 instead of $299).

import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[CREATE-SEO-AUDIT-CHECKOUT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, business_name, city, website_url } = await req.json();

    if (!email || !business_name) {
      return new Response(
        JSON.stringify({ error: "email and business_name are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedCity: string = city || "Michigan";
    const rawOrigin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const ALLOWED_ORIGINS = [
      "https://www.mattmichelstraining.com", "https://mattmichelstraining.com",
      "https://www.detroitwebagent.com", "https://detroitwebagent.com",
      "http://localhost:5173", "http://localhost:3000",
    ];
    const siteUrl = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.detroitwebagent.com";

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    // Save lead before checkout so we capture intent even on abandonment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from("free_tool_leads").insert({
        email,
        tool_used: "seo-audit-checkout",
        input_url: website_url || "",
        results_summary: { business_name, city: resolvedCity, intent: "paid_audit" },
      }).catch(() => {}); // fire-and-forget
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 4900, // $49.00
          product_data: {
            name: "Local SEO Audit — Full Report",
            description: "Comprehensive local SEO audit: on-page health analysis, keyword gap findings, competitor snapshot, and 10 prioritized action items. Delivered to your inbox within minutes of payment.",
            images: ["https://www.mattmichelstraining.com/images/m2-development-logo.png"],
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "seo_audit",
        business_name,
        city: resolvedCity,
        website_url: website_url || "",
      },
      success_url: `${siteUrl}/seo-audit?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/seo-audit`,
      allow_promotion_codes: true,
    });

    log("checkout created", { email, session_id: session.id, amount: 4900 });
    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-SEO-AUDIT-CHECKOUT] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
