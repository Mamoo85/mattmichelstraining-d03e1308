// contractor-onboarding-status — public status lookup for the onboarding page.
// Given an email or contractor_id, returns whether the contractor is "Payment
// pending" or "Ready", plus a small history of welcome SMS attempts. No PII
// beyond business_name + masked phone. verify_jwt = false (public).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function maskPhone(p: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••-•••-${digits.slice(-4)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    const contractorId = (url.searchParams.get("contractor_id") || "").trim();

    if (!email && !contractorId) {
      return new Response(JSON.stringify({
        error: "missing_lookup",
        message: "Provide ?email=... or ?contractor_id=...",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let query = sb
      .from("contractor_clients" as any)
      .select("id, business_name, email, phone, trade, city, active, stripe_customer_id, onboarded_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (contractorId) query = query.eq("id", contractorId);
    else query = query.eq("email", email);

    const { data: contractor } = await query.maybeSingle();

    // Look up the most recent provisioning audit row for this contractor/email
    let auditQuery = sb
      .from("contractor_provisioning_audit" as any)
      .select("outcome, reason, stripe_event_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (contractor?.id) auditQuery = auditQuery.eq("contractor_id", contractor.id);
    else if (email) auditQuery = auditQuery.eq("contractor_email", email);
    const { data: lastAudit } = await auditQuery.maybeSingle();

    // No contractor row + no audit = we have no record of this email at all
    if (!contractor && !lastAudit) {
      return new Response(JSON.stringify({
        status: "unknown",
        ready: false,
        headline: "We don't see a record yet",
        explanation: "If you just paid, give Stripe a minute to confirm. Refresh this page in 30 seconds. If it still doesn't show up, text Matt at (313) 992-1219.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compute readiness — same logic as the welcome-sequence guardrails
    const hasStripe = !!(contractor as any)?.stripe_customer_id;
    const isActive = (contractor as any)?.active !== false;
    const hasPhone = !!(contractor as any)?.phone;

    let status: "payment_pending" | "ready" | "blocked";
    let headline: string;
    let explanation: string;

    if (!contractor || !hasStripe) {
      status = "payment_pending";
      headline = "Payment pending";
      explanation = "We've received your checkout but Stripe hasn't confirmed payment yet. Once it clears (usually under a minute), your welcome text from Matt will arrive within 5 minutes. You'll get a second update on Day 3 and a recap on Day 7.";
    } else if (!isActive) {
      status = "blocked";
      headline = "Account paused";
      explanation = "Your account is on hold. Text Matt at (313) 992-1219 to resolve.";
    } else if (!hasPhone) {
      status = "blocked";
      headline = "Phone number missing";
      explanation = "Payment cleared, but we don't have a mobile number on file to text. Reply to your receipt with your cell, or text Matt at (313) 992-1219.";
    } else {
      status = "ready";
      headline = "Ready — welcome SMS on the way";
      explanation = "Payment cleared. Your first welcome text from Matt is sent within 5 minutes of activation. You'll get a Day 3 status text and a Day 7 recap.";
    }

    // Recent welcome SMS attempts for this contractor (success/in-flight only)
    let attempts: any[] = [];
    if (contractor?.id) {
      const { data: logs } = await sb
        .from("contractor_welcome_log" as any)
        .select("message_index, status, twilio_status, created_at")
        .eq("contractor_id", contractor.id)
        .order("created_at", { ascending: true });
      attempts = (logs as any[]) || [];
    }

    return new Response(JSON.stringify({
      status,
      ready: status === "ready",
      headline,
      explanation,
      contractor: contractor ? {
        business_name: contractor.business_name,
        trade: contractor.trade,
        city: contractor.city,
        phone_masked: maskPhone(contractor.phone),
        onboarded_at: contractor.onboarded_at,
      } : null,
      attempts: attempts.map((a) => ({
        slot: a.message_index,
        status: a.status,
        twilio_status: a.twilio_status,
        sent_at: a.created_at,
      })),
      last_audit_outcome: (lastAudit as any)?.outcome || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[contractor-onboarding-status] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
