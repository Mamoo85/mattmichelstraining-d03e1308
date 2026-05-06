// weekly-admin-digest — every Monday 8am ET
// Sends Matt a single SMS with the week's pipeline numbers across every product.
// No decision needed — just a 60-second read of what the machines did.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  try {
    // Run all counts in parallel
    const [
      techAlertProspects,
      techAlertEnriched,
      techAlertEmailed,
      techAlertReplied,
      outreachSent,
      outreachFollowups,
      deadLeadD1,
      deadLeadReplies,
      mortgageLeads,
      newTechAlertClients,
      newContractorClients,
      newMortgageClients,
    ] = await Promise.all([
      // TechAlert pipeline
      sb.from("techalert_prospect_targets").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then(r => r.count || 0),
      sb.from("techalert_prospect_targets").select("id", { count: "exact", head: true })
        .not("enriched_at", "is", null).gte("enriched_at", weekAgo).then(r => r.count || 0),
      sb.from("techalert_prospect_targets").select("id", { count: "exact", head: true })
        .not("outreach_sent_at", "is", null).gte("outreach_sent_at", weekAgo).then(r => r.count || 0),
      sb.from("techalert_prospect_targets").select("id", { count: "exact", head: true })
        .not("replied_at", "is", null).gte("replied_at", weekAgo).then(r => r.count || 0),
      // Channel prospector
      (sb.from as any)("outreach_leads").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("outreach_leads").select("id", { count: "exact", head: true })
        .or(`followup_d7_sent_at.gte.${weekAgo},followup_d14_sent_at.gte.${weekAgo}`)
        .then((r: any) => r.count || 0),
      // Dead Lead Drip
      (sb.from as any)("dead_lead_contacts").select("id", { count: "exact", head: true })
        .eq("drip_step", 1).gte("updated_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("dead_lead_contacts").select("id", { count: "exact", head: true })
        .eq("drip_step", 9).gte("updated_at", weekAgo).then((r: any) => r.count || 0),
      // Mortgage Radar
      (sb.from as any)("mortgage_radar_leads").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
      // New paying clients
      (sb.from as any)("hire_alert_clients").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("contractor_clients").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("mortgage_radar_clients").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
    ]);

    const newClients = (newTechAlertClients as number) + (newContractorClients as number) + (newMortgageClients as number);

    // Enrichment health: hit rate + Trade Radar outreach stats
    const [enrichmentTotal, enrichmentWithEmail, tradeLeadsTotal, tradeLeadsOutreached, positiveReplies, newTrials, trialsConverted] = await Promise.all([
      (sb.from as any)("outreach_leads").select("id", { count: "exact", head: true })
        .not("enriched_at", "is", null).gte("enriched_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("outreach_leads").select("id", { count: "exact", head: true })
        .not("owner_email", "is", null).gte("enriched_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("trade_radar_leads").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("trade_radar_leads").select("id", { count: "exact", head: true })
        .not("outreach_sent_at", "is", null).gte("outreach_sent_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("outreach_replies").select("id", { count: "exact", head: true })
        .eq("sentiment", "positive").gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("hire_alert_clients").select("id", { count: "exact", head: true })
        .eq("trial_status", "active").gte("created_at", weekAgo).then((r: any) => r.count || 0),
      (sb.from as any)("hire_alert_clients").select("id", { count: "exact", head: true })
        .eq("trial_status", "converted").gte("updated_at", weekAgo).then((r: any) => r.count || 0),
    ]);

    const hitRate = (enrichmentTotal as number) > 0
      ? Math.round(((enrichmentWithEmail as number) / (enrichmentTotal as number)) * 100)
      : 0;

    const msg = [
      `📊 DWA Weekly — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      ``,
      `Enrichment: ${enrichmentWithEmail}/${enrichmentTotal} emails found (${hitRate}% hit rate)`,
      ``,
      `TechAlert pipeline:`,
      ` Found ${techAlertProspects} prospects`,
      ` Enriched ${techAlertEnriched} | Emailed ${techAlertEmailed}`,
      ` Replies: ${techAlertReplied}`,
      ` Trials: ${newTrials} new | ${trialsConverted} converted`,
      ``,
      `Trade Radar: ${tradeLeadsTotal} new leads | ${tradeLeadsOutreached} auto-emailed`,
      ``,
      `Outreach (fax/postcard/sms):`,
      ` Sent ${outreachSent} | Follow-ups ${outreachFollowups}`,
      ` Positive replies: ${positiveReplies}`,
      ``,
      `Dead Lead Drip:`,
      ` D1 texts ${deadLeadD1} | Replies ${deadLeadReplies}`,
      ``,
      `Mortgage Radar: ${mortgageLeads} new leads`,
      ``,
      `New clients this week: ${newClients}`,
      `(TechAlert ${newTechAlertClients} | Contractors ${newContractorClients} | MR ${newMortgageClients})`,
    ].join("\n");

    await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "weekly_digest");

    await sb.from("agent_heartbeats").upsert({
      agent_name: "weekly-admin-digest",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: {
        techAlertProspects, techAlertEnriched, techAlertEmailed, techAlertReplied,
        outreachSent, outreachFollowups, deadLeadD1, deadLeadReplies,
        mortgageLeads, newClients,
      },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, newClients, techAlertEmailed, outreachSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
