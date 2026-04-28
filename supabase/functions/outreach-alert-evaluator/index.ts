// Sprint Wave 3 (J-trimmed) — Alert evaluator.
// Reads enrichment_alert_thresholds, evaluates each metric against live data,
// fires SMS alerts (with cooldowns) and writes to outreach_alerts_log.
// Designed to be cron-triggered every 10 minutes.
//
// Wave 5 additions:
//   - Quiet-hours filter: warn-level alerts are suppressed 9pm–7am ET
//     (logged with meta.suppressed_by_quiet_hours so UI can render a 🌙 badge).
//     Crit alerts always page through.
//   - Cost-anomaly check: hard-coded extra metric `daily_spend_anomaly` that
//     SMSes Matt when today's walker spend > 2× the 7-day rolling average
//     (and absolute spend > $5 to filter noise). Always treated as crit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Threshold {
  kind: string;
  warn_value: number;
  crit_value: number;
  sms_enabled: boolean;
  cooldown_minutes: number;
  description: string | null;
}

// ── Quiet-hours helper ──────────────────────────────────────────────────────
// Returns true if Detroit-local hour is ≥ 21 or < 7.
function isQuietHoursET(now: Date = new Date()): boolean {
  // en-US 24h hour part in America/Detroit
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Detroit",
  });
  const hourStr = fmt.format(now);
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return false;
  return hour >= 21 || hour < 7;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: thresholds, error: thErr } = await sb
    .from("enrichment_alert_thresholds")
    .select("*");
  if (thErr) {
    return json({ ok: false, error: `thresholds: ${thErr.message}` }, 500);
  }

  const fired: any[] = [];
  const quiet = isQuietHoursET();

  for (const t of (thresholds ?? []) as Threshold[]) {
    try {
      const value = await measure(sb, t.kind);
      if (value === null) continue;

      let severity: "warn" | "crit" | null = null;
      if (value >= Number(t.crit_value)) severity = "crit";
      else if (value >= Number(t.warn_value)) severity = "warn";

      if (!severity) continue;

      // Cooldown gate
      const { data: cooldown } = await sb
        .from("outreach_alert_cooldowns")
        .select("last_fired_at, last_severity")
        .eq("kind", t.kind)
        .maybeSingle();

      const cooldownMs = Number(t.cooldown_minutes) * 60_000;
      const lastFiredAt = cooldown?.last_fired_at ? new Date(cooldown.last_fired_at).getTime() : 0;
      const sinceMs = Date.now() - lastFiredAt;

      // Allow re-fire if severity escalated from warn → crit, otherwise honor cooldown.
      const escalated = cooldown?.last_severity === "warn" && severity === "crit";
      if (!escalated && sinceMs < cooldownMs) {
        fired.push({ kind: t.kind, value, severity, suppressed_by_cooldown: true });
        continue;
      }

      const message = `[Outreach ${severity.toUpperCase()}] ${t.kind} = ${value} (threshold ${severity === "crit" ? t.crit_value : t.warn_value}). ${t.description ?? ""}`.trim();

      // Wave 5: quiet-hours filter — warn alerts wait until morning, crit always pages.
      const suppressedByQuietHours = quiet && severity === "warn";

      let smsSent = false;
      if (t.sms_enabled && !suppressedByQuietHours) {
        try {
          await sendSMS({
            to: ADMIN_PHONE,
            body: message.slice(0, 320),
            product: "outreach_alert",
            allowQuietHours: severity === "crit", // crit can wake you up
          } as any);
          smsSent = true;
        } catch (smsErr) {
          console.error(`[alert-evaluator] sms fail for ${t.kind}:`, smsErr);
        }
      }

      await Promise.all([
        sb.from("outreach_alerts_log").insert({
          kind: t.kind,
          severity,
          value,
          message,
          sms_sent: smsSent,
          meta: {
            threshold: severity === "crit" ? t.crit_value : t.warn_value,
            suppressed_by_quiet_hours: suppressedByQuietHours,
          },
        }),
        sb.from("outreach_alert_cooldowns").upsert({
          kind: t.kind,
          last_fired_at: new Date().toISOString(),
          last_severity: severity,
          last_value: value,
        }),
      ]);

      fired.push({
        kind: t.kind,
        value,
        severity,
        sms_sent: smsSent,
        suppressed_by_quiet_hours: suppressedByQuietHours,
      });
    } catch (e) {
      console.error(`[alert-evaluator] ${t.kind}:`, e);
      fired.push({ kind: t.kind, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Wave 5: cost-anomaly check (always crit, ignores quiet hours) ────────
  try {
    const anomaly = await checkSpendAnomaly(sb);
    if (anomaly) {
      const { today, avg7, ratio } = anomaly;
      // Cooldown: 4 hours
      const { data: cooldown } = await sb
        .from("outreach_alert_cooldowns")
        .select("last_fired_at")
        .eq("kind", "daily_spend_anomaly")
        .maybeSingle();
      const lastFired = cooldown?.last_fired_at ? new Date(cooldown.last_fired_at).getTime() : 0;
      const sinceMs = Date.now() - lastFired;
      if (sinceMs >= 4 * 3600_000) {
        const message = `[Cost spike CRIT] $${today.toFixed(2)} spent today vs $${avg7.toFixed(2)} 7-day avg (${ratio.toFixed(1)}x). Check the walker.`;
        let smsSent = false;
        try {
          await sendSMS({
            to: ADMIN_PHONE,
            body: message.slice(0, 320),
            product: "outreach_alert",
            allowQuietHours: true, // cost issue = always wake up
          } as any);
          smsSent = true;
        } catch (smsErr) {
          console.error("[alert-evaluator] anomaly sms fail:", smsErr);
        }
        await Promise.all([
          sb.from("outreach_alerts_log").insert({
            kind: "daily_spend_anomaly",
            severity: "crit",
            value: today,
            message,
            sms_sent: smsSent,
            meta: { avg7, ratio, suppressed_by_quiet_hours: false },
          }),
          sb.from("outreach_alert_cooldowns").upsert({
            kind: "daily_spend_anomaly",
            last_fired_at: new Date().toISOString(),
            last_severity: "crit",
            last_value: today,
          }),
        ]);
        fired.push({ kind: "daily_spend_anomaly", value: today, severity: "crit", sms_sent: smsSent, ratio });
      } else {
        fired.push({ kind: "daily_spend_anomaly", value: today, severity: "crit", suppressed_by_cooldown: true });
      }
    }
  } catch (e) {
    console.error("[alert-evaluator] anomaly check failed:", e);
  }

  return json({
    ok: true,
    evaluated: thresholds?.length ?? 0,
    fired,
    quiet_hours_active: quiet,
  });
});

async function measure(sb: any, kind: string): Promise<number | null> {
  switch (kind) {
    case "error_rate_60min_pct": {
      const { data } = await sb.from("enrichment_error_rates_live").select("error_pct").maybeSingle();
      return data?.error_pct != null ? Number(data.error_pct) : null;
    }
    case "backlog_unenriched": {
      const { count } = await sb
        .from("contractor_outreach_prospects")
        .select("id", { count: "exact", head: true })
        .is("enriched_at", null)
        .is("suppressed_at", null);
      return count ?? 0;
    }
    case "dlq_depth": {
      const { count } = await sb
        .from("enrichment_dead_letter")
        .select("id", { count: "exact", head: true })
        .neq("status", "permanent");
      return count ?? 0;
    }
    case "daily_spend_usd": {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await sb
        .from("enrichment_walker_runs")
        .select("cost_estimate_usd")
        .gte("ran_at", `${today}T00:00:00Z`);
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.cost_estimate_usd ?? 0), 0);
    }
    case "cron_overdue_hours": {
      const { data } = await sb.from("cron_run_status").select("hours_since_last_success");
      const max = (data ?? []).reduce(
        (m: number, r: any) => Math.max(m, Number(r.hours_since_last_success ?? 0)),
        0,
      );
      return max;
    }
    default:
      return null;
  }
}

// Wave 5: 2x 7-day-avg cost anomaly detector.
async function checkSpendAnomaly(sb: any): Promise<{ today: number; avg7: number; ratio: number } | null> {
  const { data, error } = await sb
    .from("enrichment_provider_spend_daily")
    .select("day, spend_usd")
    .order("day", { ascending: false })
    .limit(8);
  if (error || !data || data.length === 0) return null;

  // Detroit-local "today" date string to match the view's bucketing
  const todayET = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

  const todayRow = data.find((r: any) => String(r.day) === todayET);
  const today = todayRow ? Number(todayRow.spend_usd) : 0;

  const priorRows = data.filter((r: any) => String(r.day) !== todayET).slice(0, 7);
  if (priorRows.length === 0) return null;
  const avg7 = priorRows.reduce((s: number, r: any) => s + Number(r.spend_usd ?? 0), 0) / priorRows.length;

  if (avg7 < 1.0) return null;          // baseline too small to trust
  if (today < 5) return null;            // ignore trivial spend
  const ratio = today / avg7;
  if (ratio < 2.0) return null;
  return { today, avg7, ratio };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
