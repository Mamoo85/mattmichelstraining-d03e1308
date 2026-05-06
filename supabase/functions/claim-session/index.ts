// claim-session — Post-checkout auth handoff for all DWA products.
// Called by <PostCheckoutClaim /> after Stripe redirects with ?session_id=
// Validates the Stripe session, generates a magic link, emails it to the customer.
// Public endpoint (verify_jwt = false) — auth is the Stripe session itself.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_NAMES: Record<string, string> = {
  field_service_subscription: "FieldDesk",
  hire_alert_subscription: "TechAlert",
  site_radar_subscription: "SiteRadar",
  missed_call_subscription: "Missed-Call Catch",
  mortgage_radar_subscription: "Mortgage Radar",
  phone_answering_subscription: "AI Phone Answering",
  bundle_revenue_suite: "Revenue Suite",
  ai_reputation_subscription: "AI Reputation Dashboard",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Validate via Stripe — prevents forged session IDs
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status === "unpaid") {
      return new Response(JSON.stringify({ error: "Invalid or unpaid session" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const email = session.customer_details?.email || session.customer_email;
    if (!email) {
      return new Response(JSON.stringify({ error: "No email on session" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const productType = (session.metadata?.type as string) || "";
    const productName = PRODUCT_NAMES[productType] || "Detroit Web Agency";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Generate magic link — creates the user if they don't exist yet
    const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${req.headers.get("origin") || "https://detroitwebagent.com"}/` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[claim-session] Magic link error:", linkError?.message);
      return new Response(JSON.stringify({ error: "Failed to generate login link" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const magicLink = linkData.properties.action_link;

    // Send email with magic link
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: [email],
        subject: `Your ${productName} account — click to log in`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a1628;color:#fff;padding:32px;border-radius:8px;">
            <h2 style="color:#00d4ff;margin:0 0 16px;">You're in. 🎉</h2>
            <p style="margin:0 0 12px;">Your <strong>${productName}</strong> account is ready. Click the button below to log in — no password needed.</p>
            <a href="${magicLink}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none;margin:16px 0;">Log in to ${productName} →</a>
            <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Link expires in 24 hours. If you didn't sign up for ${productName}, ignore this email.</p>
            <p style="margin:12px 0 0;font-size:13px;color:#64748b;">— Matt @ Detroit Web Agency</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ ok: true, email }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[claim-session] Error:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
