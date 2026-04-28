// Sprint Wave 3 (J-trimmed) — Alert evaluator.
// Reads enrichment_alert_thresholds, evaluates each metric against live data,
// fires SMS alerts (with cooldowns) and writes to outreach_alerts_log.
// Designed to be cron-triggered every 10 minutes.
//
// Metrics evaluated:
//   - error_rate_60min_pct   → from enrichment_error_rates_live
//   - backlog_unenriched     → count of contractor_outreach_prospects.enriched_at IS NULL
//   - dlq_depth              → count of enrichment_dead_letter where status != 'permanent'
//   - daily_spend_usd        → sum cost_estimate_usd from walker_runs today
//   - cron_overdue_hours     → from cron_run_status view
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

      let smsSent = false;
      if (t.sms_enabled) {
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
          meta: { threshold: severity === "crit" ? t.crit_value : t.warn_value },
        }),
        sb.from("outreach_alert_cooldowns").upsert({
          kind: t.kind,
          last_fired_at: new Date().toISOString(),
          last_severity: severity,
          last_value: value,
        }),
      ]);

      fired.push({ kind: t.kind, value, severity, sms_sent: smsSent });
    } catch (e) {
      console.error(`[alert-evaluator] ${t.kind}:`, e);
      fired.push({ kind: t.kind, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ ok: true, evaluated: thresholds?.length ?? 0, fired });
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
        .is("enriched_at", null);
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
