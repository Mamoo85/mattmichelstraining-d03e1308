// Returns full lead contact info for a completed PPL purchase
// Called by /lead-unlocked page immediately after Stripe redirect
// so the contractor sees name/phone/email without waiting for the webhook SMS

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get("session_id");

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up purchase by Stripe session ID
    const { data: purchase, error: purchaseErr } = await sb
      .from("contractor_lead_purchases")
      .select("lead_id, contractor_id, purchased_at")
      .eq("stripe_session_id", session_id)
      .single();

    if (purchaseErr || !purchase) {
      // Purchase may not exist yet if webhook hasn't fired — return pending status
      return new Response(
        JSON.stringify({ status: "pending" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch full lead details
    const { data: lead, error: leadErr } = await sb
      .from("contractor_leads")
      .select(
        "name, phone, email, project_type, message, contact_preference, " +
        // Quality fields (items 35, 36, 37, 38, 39, 43, 44, 45, 47). Safe if columns are null.
        "phone_carrier_type, email_breach_count, email_deliverable, identity_verified, " +
        "estimated_home_value, ownership_years, lead_type, quality_score, lead_tier, " +
        "contractor_lead_sites(trade, city, state)"
      )
      .eq("id", purchase.lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const site = (lead as any).contractor_lead_sites;
    const l = lead as any;

    return new Response(
      JSON.stringify({
        status: "ready",
        lead: {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          project_type: lead.project_type,
          message: lead.message,
          contact_preference: l.contact_preference,
          trade: site?.trade,
          city: site?.city,
          state: site?.state,
          // Quality flags — UI only renders badges when values are present
          phone_carrier_type: l.phone_carrier_type ?? null,
          email_breach_count: l.email_breach_count ?? null,
          email_deliverable: l.email_deliverable ?? null,
          identity_verified: l.identity_verified ?? null,
          estimated_home_value: l.estimated_home_value ?? null,
          ownership_years: l.ownership_years ?? null,
          lead_type: l.lead_type ?? null,
          quality_score: l.quality_score ?? null,
          lead_tier: l.lead_tier ?? null,
        },
        purchased_at: purchase.purchased_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET-LEAD-BY-SESSION] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
