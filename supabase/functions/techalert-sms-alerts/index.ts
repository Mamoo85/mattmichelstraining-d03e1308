import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Send SMS alerts to TechAlert subscribers when new high-score candidates are found.
 * Called by cron or after LARA scraper finishes.
 *
 * Body: { min_score?: number }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const minScore = body.min_score || 7;

    // Get candidates found in the last 24 hours with high scores
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates } = await supabase
      .from("hire_alert_candidates")
      .select("id, full_name, license_type, location, availability_score, claimed_at")
      .gte("availability_score", minScore)
      .gte("created_at", since)
      .is("claimed_at", null)
      .order("availability_score", { ascending: false })
      .limit(20);

    if (!candidates?.length) {
      return new Response(JSON.stringify({
        sent: 0,
        reason: "No unclaimed high-score candidates in last 24h",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get active clients with SMS enabled (phone number present)
    const { data: clients } = await supabase
      .from("hire_alert_clients")
      .select("id, company_name, phone, target_roles, sms_alerts_enabled")
      .eq("active", true)
      .eq("sms_alerts_enabled", true)
      .not("phone", "is", null);

    if (!clients?.length) {
      return new Response(JSON.stringify({
        sent: 0,
        reason: "No clients with SMS alerts enabled",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalSent = 0;
    const results: { client: string; sent: number; error?: string }[] = [];

    for (const client of clients) {
      // Filter candidates relevant to this client's target roles
      const targetRoles: string[] = client.target_roles || [];
      const relevant = targetRoles.length > 0
        ? candidates.filter((c: any) => targetRoles.some((r: string) => c.license_type.toLowerCase().includes(r.toLowerCase())))
        : candidates;

      if (relevant.length === 0) {
        results.push({ client: client.company_name, sent: 0 });
        continue;
      }

      // Build SMS message
      const topNames = relevant.slice(0, 3);
      const nameList = topNames.map((c: any) => `${c.full_name} (${c.license_type}, ${c.availability_score}/10)`).join("\n");
      const remaining = relevant.length > 3 ? `\n+${relevant.length - 3} more` : "";

      const message = `TechAlert: ${relevant.length} new candidate${relevant.length > 1 ? "s" : ""} found!\n\n${nameList}${remaining}\n\nClaim now before they're taken:\nhttps://detroitwebagent.com/field-service/dispatch?token=${client.id}\n\nReply STOP to unsubscribe`;

      try {
        await sendSMS(supabase, {
          to: client.phone,
          body: message,
          client_id: client.id,
          purpose: "techalert_candidate_sms",
        });
        totalSent++;
        results.push({ client: client.company_name, sent: 1 });
      } catch (e) {
        results.push({ client: client.company_name, sent: 0, error: String(e) });
      }
    }

    // Log the alert batch
    await supabase.from("comms_log").insert({
      type: "techalert_sms_batch",
      metadata: { total_sent: totalSent, candidates_found: candidates.length, results },
    }).catch(() => {});

    return new Response(JSON.stringify({
      sent: totalSent,
      candidates_found: candidates.length,
      clients_notified: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
