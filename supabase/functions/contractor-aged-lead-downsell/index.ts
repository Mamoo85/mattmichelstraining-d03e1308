// contractor-aged-lead-downsell — daily cron 2pm ET
// Finds contractor leads that have been unclaimed for 48h (status='new')
// Downsells them to a wider contractor pool at $15 via SMS blast.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const SITE_URL = "https://detroitwebagent.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
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
      return new Response(JSON.stringify({ ok: true, downsold: 0 }), { status: 200 });
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

        // Find all active contractors who cover this trade
        const { data: contractors } = await sb
          .from("contractor_clients")
          .select("id, phone, email")
          .eq("active", true)
          .limit(50);

        if (!contractors?.length) continue;

        // Build $15 checkout URL — checkout function handles aged_ppl_lead type
        const checkoutUrl = `${SITE_URL}/contractor-leads/aged?lead_id=${lead.id}`;

        for (const contractor of contractors) {
          if (!contractor.phone) continue;
          await sendSMS(
            contractor.phone,
            TWILIO_PHONE_NUMBER,
            `Cold Lead: Homeowner in ${city} requested a ${trade} quote 2 days ago. Unclaimed. $15 unlocks their contact info: ${checkoutUrl}&cid=${contractor.id}`,
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
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[aged-downsell] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
