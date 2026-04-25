// marketplace-buyer-receipts — POST { buyer_email, stripe_session_id }
// Returns all sold purchases for a verified buyer.
//
// SECURITY: Two layers of protection against receipt enumeration:
//   1. Stripe session proof — caller must supply a checkout session ID where
//      session.customer_email === buyer_email AND payment_status === 'paid'.
//      A random stranger cannot retrieve receipts for an email they don't own
//      because they cannot produce a paid Stripe session for it.
//   2. IP rate limit — max 10 requests/hour per IP (marketplace_receipt_access_log)
//      stops automated enumeration even with guessed session IDs.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT = 10;  // max lookups per IP per hour

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { buyer_email, stripe_session_id } = await req.json();
    if (!buyer_email || !stripe_session_id) {
      return new Response(JSON.stringify({ error: "buyer_email and stripe_session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(buyer_email).trim().toLowerCase();
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // IP extraction — Supabase edge functions are behind a proxy
    const clientIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

    // Rate limit: count access attempts in the last hour for this IP
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("marketplace_receipt_access_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", clientIp)
      .gte("accessed_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT) {
      console.warn(`[marketplace-buyer-receipts] rate-limited IP ${clientIp}`);
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }

    // Log this attempt BEFORE Stripe verification so probes count against the limit
    sb.from("marketplace_receipt_access_log")
      .insert({ ip: clientIp, buyer_email: email })
      .then(() => {})
      .catch(() => {});

    // Verify ownership: retrieve Stripe session and confirm email + payment
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(stripe_session_id);
    } catch (e) {
      console.warn("[marketplace-buyer-receipts] stripe session retrieve failed:", String(e));
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionEmail = (session.customer_email ?? "").toLowerCase().trim();
    if (sessionEmail !== email) {
      return new Response(JSON.stringify({ error: "session_email_mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "session_not_paid" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership verified — fetch all sold purchases for this email
    const { data: purchases, error: pErr } = await sb
      .from("marketplace_lead_locks")
      .select("lead_id, product, status, created_at")
      .eq("buyer_email", email)
      .eq("status", "sold")
      .order("created_at", { ascending: false });

    if (pErr) throw pErr;

    // Attach PDF signed URLs where available
    const leadIds = (purchases ?? []).map((p: any) => p.lead_id);
    const { data: pdfs } = leadIds.length > 0
      ? await sb
          .from("marketplace_lead_pdfs")
          .select("lead_id, signed_url, signed_url_expires_at")
          .in("lead_id", leadIds)
          .eq("buyer_email", email)
      : { data: [] };

    const pdfMap: Record<string, any> = {};
    for (const p of (pdfs ?? [])) pdfMap[p.lead_id] = p;

    const receipts = (purchases ?? []).map((p: any) => ({
      lead_id:        p.lead_id,
      product:        p.product,
      purchased_at:   p.created_at,
      pdf_url:        pdfMap[p.lead_id]?.signed_url ?? null,
      pdf_expires_at: pdfMap[p.lead_id]?.signed_url_expires_at ?? null,
    }));

    return new Response(JSON.stringify({ ok: true, receipts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[marketplace-buyer-receipts]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
