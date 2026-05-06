// intent-spike-notifier — Real-time SMS to Matt when an account first crosses
// score >= 75 this week. De-duped via intent_spike_alerts UNIQUE(account_key, week_start).
//
// Schedule: every 4h via pg_cron. Manual invoke: POST {} or {"threshold": 70}.
//
// Behavior:
//   1. Pull v_latest_intent_scores WHERE score >= threshold (default 75)
//   2. For each, check intent_spike_alerts for THIS week's monday — skip if exists
//   3. Insert spike row, send SMS to ADMIN_PHONE with link to admin panel
//   4. Cap at 8 SMS per run to avoid spam
//   5. Returns summary: { eligible, alerted, skipped }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_BASE_URL = "https://detroitwebagent.com/dwa-admin";
const MAX_SMS_PER_RUN = 8;

function isoWeekStart(d = new Date()): string {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const threshold = Number(body.threshold ?? 75);
  const weekStart = isoWeekStart();

  try {
    const { data: hot, error: qErr } = await sb
      .from("v_latest_intent_scores")
      .select("account_key, company_name, location, vertical, score, tier, signal_count, category_count, trajectory_delta_14d")
      .gte("score", threshold)
      .order("score", { ascending: false })
      .limit(50);
    if (qErr) throw qErr;

    let alerted = 0;
    let skipped = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const acct of hot || []) {
      if (alerted >= MAX_SMS_PER_RUN) break;
      // Atomic check-and-insert via UNIQUE(account_key, week_start)
      const { data: ins, error: insErr } = await sb
        .from("intent_spike_alerts")
        .insert({
          account_key: acct.account_key,
          triggered_score: acct.score,
          week_start: weekStart,
        })
        .select("id")
        .single();

      if (insErr) {
        // 23505 = unique_violation = already alerted this week
        if ((insErr as any).code === "23505") {
          skipped++;
          continue;
        }
        throw insErr;
      }

      const adminLink = `${ADMIN_BASE_URL}?account=${encodeURIComponent(acct.account_key)}`;
      const trajText = acct.trajectory_delta_14d
        ? ` (+${Math.round(acct.trajectory_delta_14d)} pts/14d)`
        : "";
      const msg = `🔥 ${acct.company_name} (${acct.location || "?"}) hit ${Math.round(acct.score)}${trajText} — ${acct.signal_count} signals, ${acct.category_count} cats. Pitch: ${adminLink}`.slice(0, 320);

      const smsRes = await sendSMS(ADMIN_PHONE, TWILIO_FROM, msg, "intent_spike_alert").catch((e) => ({ ok: false, error: String(e) }));

      await sb
        .from("intent_spike_alerts")
        .update({
          sms_sent_at: new Date().toISOString(),
          sms_message_id: (smsRes as any)?.sid || null,
          notes: (smsRes as any)?.ok === false ? `sms_failed: ${(smsRes as any).error}`.slice(0, 200) : null,
        })
        .eq("id", ins.id);

      alerted++;
      results.push({ account_key: acct.account_key, score: acct.score, sent: (smsRes as any)?.ok !== false });
    }

    return new Response(JSON.stringify({
      ok: true,
      eligible: hot?.length || 0,
      alerted,
      skipped,
      week_start: weekStart,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[intent-spike-notifier] FAIL:", msg);
    await logError({ source: "edge_function", function_name: "intent-spike-notifier", severity: "error", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
