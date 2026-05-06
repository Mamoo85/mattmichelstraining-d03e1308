// Resends the Stripe receipt email for a completed checkout session.
//
// Called from the success-page "Check your email" card.
// - Validates session_id and looks up the receipt row
// - Auth'd callers can resend for their own receipt; anonymous callers can
//   resend once per session per 60s (rate-limited via metadata.last_resend_at)
// - Pulls receipt_url from the Stripe PaymentIntent, sends through Resend
// - Routes from address by product_type (DWA vs M2)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;
const RESEND_COOLDOWN_MS = 60_000;

const DWA_PRODUCT_PREFIXES = [
  "field_service",
  "hire_alert",
  "contractor_lead",
  "dead_lead",
  "missed_call",
  "mortgage_radar",
  "site_radar",
  "marketplace_lead",
  "bundle_revenue_suite",
];

function isDwaProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  return DWA_PRODUCT_PREFIXES.some((p) => productType.startsWith(p));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body?.session_id;
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      return json({ error: "Missing or invalid session_id" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!STRIPE_KEY || !RESEND_KEY) {
      return json({ error: "Email service not configured" }, 500);
    }

    // Resolve caller (optional auth)
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const sbUser = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
      const { data } = await sbUser.auth.getUser(authHeader.slice("Bearer ".length));
      userEmail = data?.user?.email ?? null;
    }

    const sb = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: receipt, error } = await sb
      .from("checkout_receipts")
      .select("id, stripe_session_id, email, product_type, status, metadata")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[resend-receipt] db error:", error.message);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!receipt) return json({ error: "Receipt not found yet — try again in a moment." }, 404);
    if (!receipt.email) return json({ error: "No email on file for this receipt." }, 400);

    // Auth gate: signed-in user must own the receipt; anonymous fallback OK
    if (userEmail && userEmail.toLowerCase() !== receipt.email.toLowerCase()) {
      return json({ error: "Not authorized for this receipt." }, 403);
    }

    // Cooldown — anti-abuse, applies to all callers
    const meta = (receipt.metadata as Record<string, any>) || {};
    const lastResendIso: string | undefined = meta.last_resend_at;
    if (lastResendIso) {
      const since = Date.now() - new Date(lastResendIso).getTime();
      if (since < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
        return json({ error: `Please wait ${waitSec}s before resending.` }, 429);
      }
    }

    // Pull the Stripe receipt URL
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" });
    let receiptUrl: string | null = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent.latest_charge"],
      });
      const pi = session.payment_intent as Stripe.PaymentIntent | null;
      const charge = pi?.latest_charge as Stripe.Charge | null;
      receiptUrl = charge?.receipt_url ?? null;
    } catch (e: any) {
      console.warn("[resend-receipt] stripe lookup failed:", e?.message);
    }

    const fromEmail = isDwaProduct(receipt.product_type)
      ? "Detroit Web Agency <matt@detroitwebagent.com>"
      : "Matt Michels <matt@mattmichelstraining.com>";
    const replyTo = isDwaProduct(receipt.product_type)
      ? "matt@detroitwebagent.com"
      : "matt@mattmichelstraining.com";

    const productLabel = receipt.product_type
      ? receipt.product_type.replace(/_/g, " ")
      : "your purchase";

    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Your receipt</h2>
        <p>Here's your official Stripe receipt for <strong>${productLabel}</strong>.</p>
        ${receiptUrl ? `<p><a href="${receiptUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none">View itemized receipt</a></p>` : `<p>The Stripe receipt link is still being generated. If you don't see one within 5 minutes, reply to this email.</p>`}
        <p style="color:#475569;font-size:14px">Session: <code>${receipt.stripe_session_id}</code></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="color:#475569;font-size:13px">Questions? Reply to this email or text Matt at (313) 992-1219.</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [receipt.email],
        reply_to: replyTo,
        subject: `Your receipt — ${productLabel}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const txt = await resendRes.text();
      console.error("[resend-receipt] resend error:", resendRes.status, txt);
      return json({ error: "Failed to send email. Try again shortly." }, 502);
    }

    // Update cooldown stamp
    await sb
      .from("checkout_receipts")
      .update({ metadata: { ...meta, last_resend_at: new Date().toISOString() } })
      .eq("id", receipt.id);

    return json({
      ok: true,
      sent_to: userEmail ? receipt.email : maskEmail(receipt.email),
    });
  } catch (e: any) {
    console.error("[resend-receipt] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
