// contractor-aged-lead-downsell — daily cron 2pm ET
// Finds contractor leads that have been unclaimed for 48h (status='new')
// Downsells them to a wider contractor pool at $15 via SMS blast.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Find unclaimed leads older than 48h that haven't been downsold yet
    const { data: agedLeads } = await sb
      .from("contractor_leads")
      .select("*, contractor_lead_sites(trade, city)")
      .eq("status", "new")
      .eq("is_aged", false)
      .lte("created_at", cutoff48h)
      .limit(20);

    if (!agedLeads?.length) {
      return new Response(JSON.stringify({ ok: true, downsold: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[aged-downsell] Processing ${agedLeads.length} aged leads`);

    let downsoldCount = 0;

    for (const lead of agedLeads) {
      try {
        // Mark as aged to prevent double-blast
        await sb.from("contractor_leads")
          .update({ is_aged: true })
          .eq("id", lead.id);

        const site = (lead as any).contractor_lead_sites;
        const trade = site?.trade || lead.project_type || "Service";
        const city = site?.city || "Metro Detroit";

        // Find active contractors who cover this specific trade — no plumber gets a roofing lead
        const { data: contractors } = await sb
          .from("contractor_clients")
          .select("id, phone, email")
          .eq("active", true)
          .eq("trade", trade)
          .limit(50);

        if (!contractors?.length) continue;

        // Build $15 checkout URL — direct to Stripe via create-aged-lead-checkout function
        const checkoutUrl = `${FUNCTIONS_URL}/create-aged-lead-checkout?lead_id=${lead.id}`;

        for (const contractor of contractors) {
          if (!contractor.phone) continue;
          await sendSMS(
            contractor.phone,
            TWILIO_PHONE_NUMBER,
            `Lead in ${city}: homeowner still needs a ${trade} quote — been sitting 48h unclaimed. $15 gets you their contact info: ${checkoutUrl}&cid=${contractor.id}\nReply STOP to opt out`,
            "contractor_leads"
          );
        }

        downsoldCount++;
      } catch (e) {
        console.error(`[aged-downsell] Error for lead ${lead.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, downsold: downsoldCount, aged_leads_found: agedLeads.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[aged-downsell] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
