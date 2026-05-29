import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize trade to title case so it matches contractor_lead_sites DB values
function normalizeTrade(trade: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC",
    plumbing: "Plumbing",
    electrical: "Electrical",
    roofing: "Roofing",
    boiler: "Boiler",
    gutters: "Gutters",
    siding: "Siding",
  };
  return map[trade.toLowerCase()] || (trade.charAt(0).toUpperCase() + trade.slice(1));
}

// Allowed trade slugs (lowercase) — must match TRADES in src/pages/ContractorLeads.tsx.
const VALID_TRADE_SLUGS = new Set(["hvac", "plumbing", "electrical", "roofing", "boiler", "gutters", "siding"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { email, name, business_name, phone, trade, city, state = "MI", ref } = await req.json();

    if (!email || !trade || !city) {
      return new Response(JSON.stringify({ error: "email, trade, and city are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate trade against allowlist (mirrors public page dropdown).
    const tradeSlug = String(trade).toLowerCase().trim();
    if (!VALID_TRADE_SLUGS.has(tradeSlug)) {
      return new Response(
        JSON.stringify({ error: `Unsupported trade '${trade}'. Must be one of: ${[...VALID_TRADE_SLUGS].join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate city is non-empty after trim.
    const cityClean = String(city).trim();
    if (!cityClean) {
      return new Response(
        JSON.stringify({ error: "city must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedTrade = normalizeTrade(tradeSlug);
    const tradeLabel = normalizedTrade;
    // Trade-specific pricing — Gutters/Siding at $299, all others $399
    const TRADE_PRICES: Record<string, number> = {
      Gutters: 29900,
      Siding: 29900,
    };
    const monthlyPrice = TRADE_PRICES[normalizedTrade] || 39900;

    // DWA product — ALWAYS return contractors to detroitwebagent.com,
    // never the M2 training site (even if signup originated from m2 domain).
    const rawOrigin = req.headers.get("origin") || "";
    const isLocalhost = rawOrigin.startsWith("http://localhost");
    const origin = isLocalhost ? rawOrigin : "https://www.detroitwebagent.com";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Server-side city allowlist: must match an active contractor_lead_sites row for the chosen trade.
    // Reject early so we don't create a Stripe session for a territory we can't actually fulfill.
    const { data: territoryRow, error: territoryErr } = await sb
      .from("contractor_lead_sites")
      .select("id, active, active_contractor_id")
      .ilike("trade", normalizedTrade)
      .ilike("city", cityClean)
      .eq("active", true)
      .maybeSingle();

    if (territoryErr) {
      console.error("[CREATE-CONTRACTOR-CHECKOUT] territory lookup error:", territoryErr);
    }

    if (!territoryRow) {
      return new Response(
        JSON.stringify({
          error: `'${cityClean}' isn't an active ${normalizedTrade} territory. Pick an open city on the page or text Matt at (313) 992-1219 to request it.`,
          code: "unknown_territory",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (territoryRow.active_contractor_id) {
      return new Response(
        JSON.stringify({
          error: `${normalizedTrade} — ${cityClean} is already claimed. Pick another city or text Matt at (313) 992-1219 for the waitlist.`,
          code: "territory_claimed",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert pending contractor record (prevents duplicates on double-submit)
    const { data: contractor } = await sb
      .from("contractor_clients")
      .upsert({ name, business_name, email, phone, trade: normalizedTrade, city, state }, { onConflict: "email" })
      .select()
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: monthlyPrice,
          recurring: { interval: "month" },
          product_data: {
            name: `Exclusive ${tradeLabel} Leads — ${city}, ${state}`,
            description: `Exclusive ${tradeLabel.toLowerCase()} territory in ${city}. Includes FREE: Missed Call Text-Back ($99/mo value), Review Monitor ($25/mo), Quote Follow-Up Drip ($39/mo). Cancel anytime. 30-day money-back guarantee if zero leads delivered.`,
          },
        },
      }],
      metadata: {
        type: "contractor_lead_subscription",
        trade: normalizedTrade,
        city,
        state,
        contractor_id: contractor?.id || "",
        business_name: business_name || name,
        ...(ref ? { ref: String(ref).slice(0, 64) } : {}),
      },
      success_url: `${origin}/contractor-leads?success=1&trade=${encodeURIComponent(normalizedTrade)}&city=${encodeURIComponent(city)}&cid=${encodeURIComponent(contractor?.id || "")}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/contractor-leads`,
    });

    // Email Matt about new contractor signup attempt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `New contractor checkout started — ${tradeLabel} in ${city}`,
          html: `<p>Contractor started checkout:<br><strong>${business_name || name}</strong><br>${email} | ${phone || "no phone"}<br>Trade: ${tradeLabel} | City: ${city}, ${state}<br>Monthly: $${(monthlyPrice / 100).toFixed(0)}/mo (no trial · 30-day money-back guarantee · bonus stack auto-provisioned)<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 992-1219</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-CONTRACTOR-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
