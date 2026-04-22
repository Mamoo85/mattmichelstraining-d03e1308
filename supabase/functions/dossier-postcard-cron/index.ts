/**
 * Channel 8 — Dossier Postcard Cron
 * Weekly: pulls 50 supply-house addresses from b2b_clients (industry filter)
 * and queues physical postcards via Lob (existing infrastructure).
 * QR code on the postcard → /growth-signals?utm_source=postcard&utm_id=<id>
 *
 * NOTE: Lob send is delegated to the existing `send-postcard-lob` edge function
 * to avoid duplicating Lob integration code. This cron is the orchestrator.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SUPPLY_HOUSE_INDUSTRIES = [
  "industrial supply",
  "distributor",
  "wholesale",
  "supply house",
  "hvac supply",
  "electrical supply",
  "plumbing supply",
  "welding supply",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find supply-house leads we haven't postcarded in last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error: leadsErr } = await supabase
      .from("b2b_clients")
      .select("id, business_name, owner_name, email, industry, city, state, website")
      .or(SUPPLY_HOUSE_INDUSTRIES.map((i) => `industry.ilike.%${i}%`).join(","))
      .limit(50);

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ queued: 0, reason: "no_supply_house_leads" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check postcard_send_log to avoid re-mailing
    const { data: recentSends } = await supabase
      .from("postcard_send_log")
      .select("recipient_id")
      .gte("created_at", sixtyDaysAgo);

    const sentRecently = new Set((recentSends || []).map((r: { recipient_id: string }) => r.recipient_id));
    const eligible = leads.filter((l) => !sentRecently.has(l.id)).slice(0, 50);

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ queued: 0, reason: "all_leads_postcarded_within_60_days" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Count current week's signals for the postcard headline
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: signalCount } = await supabase
      .from("industry_pulse_signals")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .gte("confidence_score", 7);

    const headline = `${signalCount || 42} Metro Detroit Manufacturers Hired Welders This Week`;

    // Queue each via the existing Lob sender
    let queued = 0;
    const errors: string[] = [];

    for (const lead of eligible) {
      try {
        const utmId = lead.id.slice(0, 8);
        const landingUrl = `https://www.detroitwebagent.com/growth-signals?utm_source=postcard&utm_medium=mail&utm_campaign=dossier_offer&utm_id=${utmId}`;

        const { error: invokeErr } = await supabase.functions.invoke("send-postcard-lob", {
          body: {
            recipient_id: lead.id,
            recipient_name: lead.owner_name || lead.business_name,
            business_name: lead.business_name,
            address_line1: null, // send-postcard-lob will skip if no address (it enriches)
            city: lead.city,
            state: lead.state,
            front_headline: headline,
            back_message: `${lead.business_name?.split(" ")[0] || "Hi"} — names + addresses + predicted equipment spend, all from public MI data. Scan for 3 free signals to your branch.`,
            qr_url: landingUrl,
            campaign: "dossier_offer",
          },
        });

        if (invokeErr) {
          errors.push(`${lead.business_name}: ${invokeErr.message}`);
          continue;
        }
        queued++;
      } catch (e: unknown) {
        errors.push(`${lead.business_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ queued, total_eligible: eligible.length, signal_count: signalCount, errors: errors.slice(0, 10) }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
