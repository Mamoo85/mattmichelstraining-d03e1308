// Hourly health check for the enrichment waterfall.
// Returns JSON status + SMSes Matt if anything is critically stuck.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

async function sendSMS(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return;
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    });
  } catch (_e) {/* best-effort */}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1) Pending candidates stuck > 2h
    const { count: stuckPending } = await sb
      .from("hire_alert_candidates")
      .select("id", { count: "exact", head: true })
      .eq("enrichment_status", "pending")
      .lt("first_seen_at", twoHoursAgo);

    // 2) Status breakdown
    const { data: statusRows } = await sb
      .from("hire_alert_candidates")
      .select("enrichment_status");
    const statusCounts: Record<string, number> = {};
    for (const r of statusRows || []) {
      const k = (r as any).enrichment_status || "unknown";
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    }

    // 3) API failure detection in last 24h via candidate_enrichment_log
    const { data: failures } = await sb
      .from("candidate_enrichment_log")
      .select("source, success")
      .gte("created_at", oneDayAgo)
      .eq("success", false)
      .limit(1000);

    const failBySource: Record<string, number> = {};
    for (const f of failures || []) {
      const s = (f as any).source || "unknown";
      failBySource[s] = (failBySource[s] || 0) + 1;
    }

    // 4) Last scanner heartbeat
    const { data: hb } = await sb
      .from("agent_heartbeats")
      .select("last_beat, metadata")
      .eq("agent_name", "hire-alert-scanner")
      .single();

    const lastBeat = (hb as any)?.last_beat;
    const beatAgeMin = lastBeat
      ? Math.round((Date.now() - new Date(lastBeat).getTime()) / 60000)
      : null;

    // 5) Determine overall status
    let level: "green" | "yellow" | "red" = "green";
    const issues: string[] = [];

    if ((stuckPending || 0) > 50) {
      level = "red";
      issues.push(`${stuckPending} candidates stuck pending > 2h`);
    } else if ((stuckPending || 0) > 20) {
      level = "yellow";
      issues.push(`${stuckPending} candidates stuck pending > 2h`);
    }

    for (const [src, n] of Object.entries(failBySource)) {
      if (n >= 10) {
        level = "red";
        issues.push(`${src} API: ${n} failures in 24h`);
      } else if (n >= 3 && level !== "red") {
        level = "yellow";
        issues.push(`${src} API: ${n} failures in 24h`);
      }
    }

    // Stale heartbeat — only critical if there's ALSO a real backlog. The deep-enrich
    // agent only runs when the queue has work, so an idle agent = empty queue = healthy.
    // Threshold bumped 6h → 24h to match real-world idle periods.
    if (beatAgeMin !== null && beatAgeMin > 1440 && (stuckPending || 0) > 0) {
      level = "red";
      issues.push(`Scanner heartbeat ${beatAgeMin}min stale with ${stuckPending} pending`);
    }

    // 6) Alert Matt if RED (max 1 SMS per 24 hours — was 4h, was too noisy)
    const { data: lastAlert } = await sb
      .from("system_comms_log")
      .select("created_at")
      .eq("product", "enrichment_health")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const alertAgeMin = lastAlert
      ? (Date.now() - new Date((lastAlert as any).created_at).getTime()) / 60000
      : 9999;

    if (level === "red" && alertAgeMin > 1440) {
      await sendSMS(
        ADMIN_PHONE,
        `⚠️ Enrichment ${level.toUpperCase()}: ${issues.join("; ")}`.slice(0, 320),
      );
      await sb.from("system_comms_log").insert({
        channel: "sms",
        product: "enrichment_health",
        recipient: ADMIN_PHONE,
        body_preview: issues.join("; ").slice(0, 200),
        status: "sent",
      });
    }

    return new Response(
      JSON.stringify({
        level,
        issues,
        stuck_pending: stuckPending || 0,
        status_counts: statusCounts,
        api_failures_24h: failBySource,
        scanner_heartbeat_min_ago: beatAgeMin,
        checked_at: new Date().toISOString(),
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
