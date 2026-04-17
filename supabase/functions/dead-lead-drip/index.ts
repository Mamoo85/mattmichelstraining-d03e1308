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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Trade-specific SMS copy — more relevant than generic "{trade}" substitution
const TRADE_TEMPLATES: Record<string, { d1: string; d2: string; d3: string }> = {
  hvac: {
    d1: `Hey {name}, this is the office at {bizName}. Just checking in — is your HVAC system still giving you trouble, or did you find someone to handle it?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. A lot of folks are scheduling service before the season peaks and we book up fast. We can usually get out in 2-3 days. Reply YES to lock in a spot.\nReply STOP to opt out`,
    d3: `Last note from {bizName}. If your heating or cooling ever needs attention, just reply and we'll take care of you. Stay comfortable out there!\nReply STOP to opt out`,
  },
  roofing: {
    d1: `Hey {name}, {bizName} here — following up on that roofing quote from a while back. Did you ever get that taken care of, or are you still looking at it?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Wanted to reach out before the weather turns. A small roof issue now can turn into a major repair after the first freeze. We can get eyes on it this week.\nReply STOP to opt out`,
    d3: `Last message from {bizName}. Another Michigan winter's coming — if that roof still needs work, reply YES and we'll get you squared away before the snow flies.\nReply STOP to opt out`,
  },
  plumbing: {
    d1: `Hey {name}, this is {bizName} following up. Did that plumbing issue ever get resolved, or is it still something you're dealing with?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} here. Plumbing problems have a way of getting worse when you wait. If it's still bothering you, reply YES and we'll get someone out fast.\nReply STOP to opt out`,
    d3: `Last follow-up from {bizName}. That leak or drain issue won't fix itself — whenever you're ready, we're a quick reply away. Take care!\nReply STOP to opt out`,
  },
  electrical: {
    d1: `Hey {name}, {bizName} following up. Did you ever get that electrical work taken care of, or is it still on the list? We're booking this week.\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Electrical issues are one thing you really don't want to delay. We have openings this week — just reply YES.\nReply STOP to opt out`,
    d3: `Last check-in from {bizName}. Whenever you're ready to get that electrical sorted, we're here. Stay safe!\nReply STOP to opt out`,
  },
  general: {
    d1: `Hey {name}, this is the dispatch desk following up for {bizName}. Did you ever get that {trade} issue taken care of, or are you still looking for a quote?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Still available if you need {trade} help. Just reply YES and we'll get someone out to you.\nReply STOP to opt out`,
    d3: `Last follow-up from {bizName} — if you ever need {trade} work in the future, just reply and we'll make it easy. Take care!\nReply STOP to opt out`,
  },
};

function getTradeTemplate(trade: string, drip: "d1" | "d2" | "d3"): string {
  const key = trade.toLowerCase().replace(/[^a-z]/g, "");
  const tpl = TRADE_TEMPLATES[key] || TRADE_TEMPLATES.general;
  return tpl[drip];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // TCPA EBR cutoff: 18 months from last business contact
    const eighteenMonthsAgo = new Date(now.getTime() - 548 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    let drip1Count = 0, drip2Count = 0, drip3Count = 0, tcpaSkipped = 0;

    // ── TCPA SWEEP: terminate any contact past 18-month EBR window ────────
    // Runs BEFORE drip queries so expired leads can never be texted.
    const { data: expired, error: expiredErr } = await sb
      .from("dead_lead_contacts" as any)
      .update({ status: "tcpa_expired" })
      .lt("last_contact_date", eighteenMonthsAgo)
      .in("status", ["pending", "drip1_sent", "drip2_sent"])
      .select("id");
    if (expiredErr) console.error("[drip] TCPA sweep error:", expiredErr);
    tcpaSkipped = expired?.length || 0;

    // ── DRIP 1: pending contacts in active campaigns ──────────────────────
    // .gte() filter enforces EBR at query level. Contacts with NULL
    // last_contact_date are excluded (safer to skip than risk a violation).
    const { data: drip1Contacts } = await sb
      .from("dead_lead_contacts" as any)
      .select("*, dead_lead_campaigns(id, trade, status, contractor_id, contractor_clients(business_name, phone))")
      .eq("status", "pending")
      .not("dead_lead_campaigns", "is", null)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of drip1Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const contractor = (campaign as any).contractor_clients;
        const bizName = contractor?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        // Use selected custom copy variant if available, else default template
        const { data: customCopy } = await sb
          .from("campaign_copy_variants" as any)
          .select("drip1_copy")
          .eq("campaign_id", campaign.id)
          .eq("selected", true)
          .maybeSingle();

        const body = customCopy?.drip1_copy
          ? customCopy.drip1_copy
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade)
          : getTradeTemplate(trade, "d1")
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade);

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          body,
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
      .not("drip1_sent_at", "is", null)
      .lte("drip1_sent_at", twoDaysAgo)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of drip2Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        const { data: customCopy } = await sb
          .from("campaign_copy_variants" as any)
          .select("drip2_copy")
          .eq("campaign_id", campaign.id)
          .eq("selected", true)
          .maybeSingle();

        const body = customCopy?.drip2_copy
          ? customCopy.drip2_copy
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade)
          : getTradeTemplate(trade, "d2")
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade);

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          body,
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
      .not("drip2_sent_at", "is", null)
      .lte("drip2_sent_at", twoDaysAgo)
      .not("last_contact_date", "is", null)
      .gte("last_contact_date", eighteenMonthsAgo)
      .limit(200);

    for (const contact of drip3Contacts || []) {
      try {
        const campaign = (contact as any).dead_lead_campaigns;
        if (campaign?.status !== "active") continue;
        const bizName = (campaign as any).contractor_clients?.business_name || "your contractor";
        const trade = campaign?.trade || "service";
        const firstName = contact.name?.split(" ")[0] || "there";

        const { data: customCopy } = await sb
          .from("campaign_copy_variants" as any)
          .select("drip3_copy")
          .eq("campaign_id", campaign.id)
          .eq("selected", true)
          .maybeSingle();

        const body = customCopy?.drip3_copy
          ? customCopy.drip3_copy
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade)
          : getTradeTemplate(trade, "d3")
              .replace("{name}", firstName)
              .replace("{bizName}", bizName)
              .replace("{trade}", trade);

        await sendSMS(
          contact.phone,
          TWILIO_PHONE_NUMBER,
          body,
          "dead_lead_reactivation"
        );

        await sb.from("dead_lead_contacts" as any)
          .update({ status: "drip3_sent", drip3_sent_at: now.toISOString() })
          .eq("id", contact.id);

        drip3Count++;
      } catch (e) { console.error("[drip] drip3 error for contact", contact.id, e); }
    }

    console.log(`[dead-lead-drip] drip1=${drip1Count} drip2=${drip2Count} drip3=${drip3Count} tcpa_expired=${tcpaSkipped}`);
    return new Response(
      JSON.stringify({ ok: true, drip1: drip1Count, drip2: drip2Count, drip3: drip3Count, tcpa_expired: tcpaSkipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dead-lead-drip] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
