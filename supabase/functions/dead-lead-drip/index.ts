// dead-lead-drip — daily cron 10am ET
// Sends white-labeled SMS drip to contractors' old dead leads.
// Messages appear to come from the contractor's office — NOT from DWA.
// 3-message sequence over 5 days. Handles YES/NO/OPT_OUT replies via handle-dead-lead-reply.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    let drip1Count = 0, drip2Count = 0, drip3Count = 0;

    // ── DRIP 1: pending contacts in active campaigns ──────────────────────
    const { data: drip1Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_id, contractor_clients(business_name, phone))")
      .eq("status", "pending")
      .limit(50);

    for (const contact of drip1Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const contractor = (campaign as any).contractor_clients;
        const bizName = contractor?.business_name || "your contractor";
        const trade = campaign?.trade || "service";

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          `Hey ${contact.name?.split(" ")[0] || "there"}, this is the dispatch desk following up for ${bizName}. Did you ever get that ${trade} issue taken care of, or are you still looking for a quote?`,
          "dead_lead_reactivation"
        );

        await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip1_sent", drip1_sent_at: now.toISOString() })
          .eq("id", contact.id);

        drip1Count++;
      } catch (e) { console.error("[drip] drip1 error for contact", contact.id, e); }
    }

    // ── DRIP 2: drip1_sent contacts where 2+ days have passed ────────────
    const { data: drip2Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_clients(business_name))")
      .eq("status", "drip1_sent")
      .lte("drip1_sent_at", twoDaysAgo)
      .limit(50);

    for (const contact of drip2Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          `Hey ${contact.name?.split(" ")[0] || "there"} — ${bizName} again. Still available if you need ${trade} help. Just reply YES and we'll get someone out to you.`,
          "dead_lead_reactivation"
        );

        await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip2_sent", drip2_sent_at: now.toISOString() })
          .eq("id", contact.id);

        drip2Count++;
      } catch (e) { console.error("[drip] drip2 error for contact", contact.id, e); }
    }

    // ── DRIP 3: drip2_sent contacts where 2+ days have passed ────────────
    const { data: drip3Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_clients(business_name))")
      .eq("status", "drip2_sent")
      .lte("drip2_sent_at", twoDaysAgo)
      .limit(50);

    for (const contact of drip3Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          `Last follow-up from ${bizName} — if you ever need ${trade} work in the future, just reply and we'll make it easy. Take care!`,
          "dead_lead_reactivation"
        );

        await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip3_sent", drip3_sent_at: now.toISOString() })
          .eq("id", contact.id);

        drip3Count++;
      } catch (e) { console.error("[drip] drip3 error for contact", contact.id, e); }
    }

    console.log(`[dead-lead-drip] drip1=${drip1Count} drip2=${drip2Count} drip3=${drip3Count}`);
    return new Response(
      JSON.stringify({ ok: true, drip1: drip1Count, drip2: drip2Count, drip3: drip3Count }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dead-lead-drip] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
