// enrichment-kpi-monitor
// Runs every 30 min during business hours. Computes last-2h enrichment throughput,
// compares against required rate to hit the daily 150-send floor, and SMS-alerts
// Matt when actual < (alert_floor_ratio × required) for 2 consecutive checks.
// Cooldown: max 1 SMS per 90 min.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const FLOOR = 150;
const SEND_WINDOW_END_ET_HOUR = 20; // 8pm ET

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hoursLeftInET(): number {
  // Approx ET: now in UTC, subtract 5h (EST) — close enough for a soft alert
  const nowUtc = new Date();
  const etHour = (nowUtc.getUTCHours() - 5 + 24) % 24;
  const etMin = nowUtc.getUTCMinutes();
  const left = SEND_WINDOW_END_ET_HOUR - etHour - etMin / 60;
  return Math.max(0.5, left);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Last 2h of KPI rows
    const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { data: kpis } = await sb
      .from("enrichment_run_kpis")
      .select("leads_enriched, total_duration_ms, run_at")
      .gte("run_at", since)
      .order("run_at", { ascending: false });

    const enriched2h = (kpis || []).reduce((s: number, r: any) => s + (r.leads_enriched || 0), 0);
    const actualPerHour = enriched2h / 2;

    // Compute current target gap (sends remaining today)
    const today = new Date().toISOString().split("T")[0];
    const { data: sends } = await sb
      .from("email_send_log")
      .select("message_id")
      .eq("status", "sent")
      .gte("created_at", `${today}T00:00:00Z`);
    const sentToday = new Set((sends || []).map((r: any) => r.message_id).filter(Boolean)).size;
    const gap = Math.max(0, FLOOR - sentToday);
    const hoursLeft = hoursLeftInET();
    const requiredPerHour = gap / hoursLeft;

    // Threshold
    const { data: thrCfg } = await sb
      .from("enrichment_walker_config")
      .select("value_numeric")
      .eq("key", "throughput_alert_floor_ratio")
      .maybeSingle();
    const floorRatio = Number(thrCfg?.value_numeric ?? 0.6);

    const behind = gap > 0 && actualPerHour < floorRatio * requiredPerHour;

    // Consecutive-check tracking via enrichment_walker_config
    const { data: stateCfg } = await sb
      .from("enrichment_walker_config")
      .select("value_numeric, value_text, updated_at")
      .eq("key", "throughput_behind_streak")
      .maybeSingle();
    let streak = Number(stateCfg?.value_numeric ?? 0);
    streak = behind ? streak + 1 : 0;
    await sb.from("enrichment_walker_config").upsert({
      key: "throughput_behind_streak",
      value_numeric: streak,
      value_text: behind ? "behind" : "ok",
    }, { onConflict: "key" });

    // SMS cooldown check
    let smsSent = false;
    if (behind && streak >= 2) {
      const { data: lastAlert } = await sb
        .from("enrichment_walker_config")
        .select("value_text, updated_at")
        .eq("key", "throughput_last_alert_at")
        .maybeSingle();
      const lastAt = lastAlert?.value_text ? new Date(lastAlert.value_text).getTime() : 0;
      const cooldownOk = Date.now() - lastAt > 90 * 60 * 1000;
      if (cooldownOk) {
        await sendSMS(
          ADMIN_PHONE,
          `⚠️ Enrichment behind: ${actualPerHour.toFixed(0)}/hr vs ${requiredPerHour.toFixed(0)}/hr needed. ` +
          `Gap=${gap}, ${hoursLeft.toFixed(1)}h left. Sent today: ${sentToday}/${FLOOR}.`,
        ).catch(() => {});
        await sb.from("enrichment_walker_config").upsert({
          key: "throughput_last_alert_at",
          value_text: new Date().toISOString(),
        }, { onConflict: "key" });
        smsSent = true;
      }
    }

    return new Response(JSON.stringify({
      ok: true, enriched2h, actualPerHour, requiredPerHour, gap, hoursLeft,
      sentToday, floor: FLOOR, behind, streak, smsSent,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
