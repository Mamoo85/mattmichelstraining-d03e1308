// code-fixer-watchdog — Autonomous error detection and remediation.
//
// Triggered by:
//   1. Postgres trigger (immediate) on error_logs INSERT severity=error|critical
//   2. pg_cron every 15 minutes (sweep missed errors)
//   3. inbound-sms-relay when Matt texts "FIX" to the DWA number
//
// For each unresolved error it classifies the failure, attempts an auto-fix,
// logs results to fixer_queue + fixer_runs, and SMS-alerts Matt on any
// fix applied or escalation needed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";
import { generateWithOpus } from "../_shared/opus.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

// How far back to look on a cron sweep (seconds)
const SWEEP_WINDOW_SECS = 900; // 15 min

type FixCategory =
  | "retry_email"
  | "retry_sms"
  | "retry_function"
  | "restart_cron"
  | "clear_stale_lock"
  | "unknown";

interface ErrorRow {
  id: string;
  source: string;
  function_name: string | null;
  severity: string;
  error_message: string;
  http_status: number | null;
  payload: Record<string, unknown> | null;
  recipient: string | null;
  created_at: string;
}

function classify(err: ErrorRow): FixCategory {
  const src = err.source?.toLowerCase() || "";
  const msg = (err.error_message || "").toLowerCase();
  const status = err.http_status ?? 0;

  if (src === "resend") return "retry_email";
  if (src === "twilio") return "retry_sms";
  if (src === "cron") return "restart_cron";
  if (msg.includes("stale lock") || msg.includes("marketplace_lead_locks")) return "clear_stale_lock";
  if (src === "edge_function" && status >= 500) return "retry_function";
  if (src === "stripe" && status >= 500) return "retry_function";
  return "unknown";
}

async function attemptFix(
  sb: ReturnType<typeof createClient>,
  err: ErrorRow,
  category: FixCategory
): Promise<{ success: boolean; detail: string }> {
  try {
    switch (category) {
      case "retry_email": {
        if (!err.payload?.to || !err.payload?.subject) {
          return { success: false, detail: "Missing email payload — cannot retry" };
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(err.payload),
        });
        return res.ok
          ? { success: true, detail: `Email re-sent (status ${res.status})` }
          : { success: false, detail: `Resend retry failed: ${res.status}` };
      }

      case "retry_sms": {
        if (!err.recipient) {
          return { success: false, detail: "No recipient for SMS retry" };
        }
        const body = (err.payload?.body as string) || "Detroit Web Agency follow-up — please reply if you need help.";
        const result = await sendSMS(err.recipient, TWILIO_PHONE, body, "fixer_retry");
        return result.success
          ? { success: true, detail: "SMS re-sent via sendSMS" }
          : { success: false, detail: "SMS retry also failed" };
      }

      case "retry_function": {
        const fnName = err.function_name;
        if (!fnName) return { success: false, detail: "No function_name to retry" };
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ _fixer_retry: true }),
        });
        return res.ok
          ? { success: true, detail: `${fnName} re-invoked (status ${res.status})` }
          : { success: false, detail: `${fnName} retry failed: ${res.status}` };
      }

      case "restart_cron": {
        const fnName = err.function_name;
        if (!fnName) return { success: false, detail: "No cron function_name" };
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ _fixer_cron_restart: true }),
        });
        return res.ok
          ? { success: true, detail: `Cron function ${fnName} restarted` }
          : { success: false, detail: `Cron restart failed: ${res.status}` };
      }

      case "clear_stale_lock": {
        const { error } = await (sb.from("marketplace_lead_locks") as any)
          .update({ status: "released" })
          .eq("status", "soft_lock")
          .lt("expires_at", new Date().toISOString());
        return error
          ? { success: false, detail: `Lock clear failed: ${error.message}` }
          : { success: true, detail: "Stale soft_locks released" };
      }

      case "unknown": {
        const diagnosis = await generateWithOpus(
          `An edge function logged this error. Diagnose in 2 sentences and state if it is self-healing or needs a code fix:\n\nSource: ${err.source}\nFunction: ${err.function_name}\nError: ${err.error_message}\nHTTP status: ${err.http_status}`,
          "You are a senior Deno/Supabase engineer diagnosing production errors. Be concise.",
          400
        );
        return { success: false, detail: `Opus diagnosis: ${diagnosis}` };
      }
    }
  } catch (e: unknown) {
    return { success: false, detail: `Fix threw: ${e instanceof Error ? e.message : String(e)}` };
  }
}

serve(async (req) => {
  const started = new Date().toISOString();

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let trigger = "cron";
  let specificErrorId: string | null = null;
  try {
    const body = await req.json();
    trigger = body.trigger || "cron";
    specificErrorId = body.error_id || null;
  } catch {
    // body parse failure is fine — default to cron sweep
  }

  // Insert fixer_run record
  const { data: runRow } = await sb
    .from("fixer_runs")
    .insert({ triggered_by: trigger })
    .select("id")
    .single();
  const runId = runRow?.id;

  // Fetch errors to process
  let query = sb
    .from("error_logs")
    .select("id,source,function_name,severity,error_message,http_status,payload,recipient,created_at")
    .in("severity", ["error", "critical"]);

  if (specificErrorId) {
    query = query.eq("id", specificErrorId);
  } else {
    const since = new Date(Date.now() - SWEEP_WINDOW_SECS * 1000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data: errors } = await query.order("created_at", { ascending: true }).limit(20);
  const errList: ErrorRow[] = (errors as ErrorRow[]) || [];

  // Skip errors already queued and being worked
  const { data: alreadyQueued } = await sb
    .from("fixer_queue")
    .select("error_log_id")
    .in("status", ["queued", "in_progress", "fixed"])
    .in("error_log_id", errList.map((e) => e.id));
  const skip = new Set((alreadyQueued || []).map((r: { error_log_id: string }) => r.error_log_id));
  const toProcess = errList.filter((e) => !skip.has(e.id));

  let fixed = 0;
  let failed = 0;
  let escalated = 0;
  const summaryLines: string[] = [];

  for (const err of toProcess) {
    const category = classify(err);

    // Insert queue row
    const { data: qRow } = await sb
      .from("fixer_queue")
      .insert({
        error_log_id: err.id,
        source: err.source,
        function_name: err.function_name,
        error_message: err.error_message,
        fix_category: category,
        status: "in_progress",
        attempts: 1,
      })
      .select("id")
      .single();
    const qId = qRow?.id;

    const { success, detail } = await attemptFix(sb as any, err, category);

    const finalStatus = success ? "fixed" : category === "unknown" ? "escalated" : "failed";
    if (qId) {
      await sb
        .from("fixer_queue")
        .update({
          status: finalStatus,
          fix_applied: success ? category : null,
          result_message: detail,
          resolved_at: success ? new Date().toISOString() : null,
        })
        .eq("id", qId);
    }

    if (success) {
      fixed++;
      summaryLines.push(`✅ ${category}: ${err.function_name || err.source}`);
    } else if (finalStatus === "escalated") {
      escalated++;
      summaryLines.push(`🔬 Escalated [${err.source}/${err.function_name}]: ${detail.slice(0, 80)}`);
    } else {
      failed++;
      summaryLines.push(`❌ ${category} failed: ${err.function_name || err.source}`);
    }
  }

  // Update fixer_run
  const summary = summaryLines.join(" | ") || "No new errors found";
  if (runId) {
    await sb
      .from("fixer_runs")
      .update({
        errors_found: toProcess.length,
        errors_fixed: fixed,
        errors_failed: failed,
        errors_escalated: escalated,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  // Update agent heartbeat
  await sb
    .from("agent_heartbeats")
    .upsert({ agent_name: "fixer", last_beat: new Date().toISOString() }, { onConflict: "agent_name" });

  // SMS Matt only when something actually happened
  if (toProcess.length > 0) {
    const smsParts: string[] = [];
    if (fixed > 0) smsParts.push(`🔧 AutoFix: ${fixed} resolved`);
    if (escalated > 0) smsParts.push(`🔬 ${escalated} escalated (needs code fix)`);
    if (failed > 0) smsParts.push(`❌ ${failed} fix attempts failed`);
    if (smsParts.length > 0) {
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE,
        smsParts.join(" | ") + ` — reply ERRORS for details`,
        "fixer",
        false,
        { bypassQuietHours: true }
      );
    }
  }

  // Log own errors if fixer itself throws — use warn so it doesn't recurse
  if (failed > 0 || escalated > 0) {
    logError({
      source: "edge_function",
      function_name: "code-fixer-watchdog",
      severity: "warn",
      error_message: `Fixer run: ${fixed} fixed, ${failed} failed, ${escalated} escalated`,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, trigger, found: toProcess.length, fixed, failed, escalated, summary }),
    { headers: { "Content-Type": "application/json" } }
  );
});
