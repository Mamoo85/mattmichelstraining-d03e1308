// Outreach Queue Worker
// Claims pending send jobs via SELECT FOR UPDATE SKIP LOCKED, sends them, marks results.
// Designed to run every minute via pg_cron — safe for concurrent invocation.
// SMS goes through _shared/twilio.ts → enforces TCPA opt-out + quiet-hours.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");

const BATCH_SIZE = 20;
const MAX_RUNTIME_MS = 50_000; // stay under 60s edge function timeout

interface Job {
  id: string;
  channel: "email" | "sms";
  prospect_id: string | null;
  lead_id: string | null;
  attempts: number;
  payload: {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    from?: string;
    headers?: Record<string, string>;
    body?: string; // sms body
  };
}

async function sendEmail(job: Job): Promise<{ ok: boolean; error?: string }> {
  const { to, subject, html, from, headers } = job.payload;
  if (!to || !subject || !html) return { ok: false, error: "missing email payload fields" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || "Matt Michels <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
      headers,
      tags: [
        { name: "queue_job_id", value: job.id },
        { name: "channel", value: "outreach" },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 400) };
  }
  return { ok: true };
}

async function sendSms(job: Job): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_FROM) return { ok: false, error: "twilio not configured" };
  const { to, body } = job.payload;
  if (!to || !body) return { ok: false, error: "missing sms payload fields" };
  // Route via shared helper → TCPA opt-out scrub + FCC quiet-hours + audit log.
  const r = await sendSMS(to, TWILIO_FROM, body, "outreach_drip");
  if (!r.success) return { ok: false, error: r.error || "send failed" };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const stats = { claimed: 0, sent: 0, failed: 0, dead: 0 };

  try {
    while (Date.now() - startedAt < MAX_RUNTIME_MS) {
      const { data: jobs, error: claimErr } = await supabase
        .rpc("claim_outreach_send_jobs", { p_worker_id: workerId, p_batch_size: BATCH_SIZE });

      if (claimErr) {
        console.error("claim error", claimErr);
        return new Response(JSON.stringify({ error: claimErr.message, stats }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!jobs || jobs.length === 0) break; // queue empty
      stats.claimed += jobs.length;

      // Cache global settings once per batch (changes are rare; reduces DB hits)
      const { data: gs } = await supabase
        .from("outreach_global_settings").select("*").eq("id", 1).single();

      // Send sequentially to respect rate limits — each provider call awaited
      for (const job of jobs as Job[]) {
        try {
          // Pre-send re-check: kill switch
          const killSwitchOff = job.channel === "email"
            ? gs?.cold_email_enabled === false
            : gs?.cold_sms_enabled === false;
          if (killSwitchOff) {
            await supabase.rpc("mark_outreach_send_result", {
              p_job_id: job.id, p_success: false, p_error_msg: "kill_switch",
            });
            await supabase.from("contractor_outreach_audit_log").insert({
              prospect_id: job.prospect_id, lead_id: job.lead_id,
              channel: job.channel, event: "quiet_hours_blocked",
              reason: "Kill switch flipped after enqueue",
              metadata: { job_id: job.id, worker: workerId },
            });
            stats.failed++;
            continue;
          }

          // Pre-send re-check: prospect unsubscribed since enqueue
          if (job.prospect_id) {
            const { data: pCheck } = await supabase
              .from("contractor_outreach_prospects")
              .select("unsubscribed_at, email, phone")
              .eq("id", job.prospect_id)
              .maybeSingle();
            if (pCheck?.unsubscribed_at) {
              await supabase.rpc("mark_outreach_send_result", {
                p_job_id: job.id, p_success: false, p_error_msg: "unsubscribed",
              });
              await supabase.from("contractor_outreach_audit_log").insert({
                prospect_id: job.prospect_id, lead_id: job.lead_id,
                channel: job.channel, event: "suppressed",
                reason: "Prospect unsubscribed after enqueue",
                metadata: { job_id: job.id, worker: workerId },
              });
              stats.failed++;
              continue;
            }
            // Pre-send re-check: contact added to suppression since enqueue
            const contact = job.channel === "email" ? pCheck?.email : pCheck?.phone;
            if (contact) {
              const { data: supRow } = await supabase
                .from("contractor_outreach_suppression")
                .select("id")
                .eq("contact_type", job.channel)
                .ilike("contact", contact)
                .maybeSingle();
              if (supRow) {
                await supabase.rpc("mark_outreach_send_result", {
                  p_job_id: job.id, p_success: false, p_error_msg: "suppressed",
                });
                await supabase.from("contractor_outreach_audit_log").insert({
                  prospect_id: job.prospect_id, lead_id: job.lead_id,
                  channel: job.channel, event: "suppressed",
                  reason: "Contact suppressed after enqueue",
                  metadata: { job_id: job.id, worker: workerId },
                });
                stats.failed++;
                continue;
              }
            }
          }

          const result = job.channel === "email" ? await sendEmail(job) : await sendSms(job);

          await supabase.rpc("mark_outreach_send_result", {
            p_job_id: job.id, p_success: result.ok, p_error_msg: result.error ?? null,
          });

          // Audit log
          if (result.ok) {
            stats.sent++;
            await supabase.from("contractor_outreach_audit_log").insert({
              prospect_id: job.prospect_id, lead_id: job.lead_id,
              channel: job.channel, event: "sent",
              reason: job.payload.subject || "queued send",
              metadata: { job_id: job.id, worker: workerId, attempt: job.attempts },
            });
            // Bump prospect last_*_at counters
            if (job.prospect_id) {
              const col = job.channel === "email" ? "last_emailed_at" : "last_smsed_at";
              await supabase.from("contractor_outreach_prospects")
                .update({ [col]: new Date().toISOString() })
                .eq("id", job.prospect_id);
            }
          } else {
            stats.failed++;
            const isDead = job.attempts >= 3;
            if (isDead) stats.dead++;
            await supabase.from("contractor_outreach_audit_log").insert({
              prospect_id: job.prospect_id, lead_id: job.lead_id,
              channel: job.channel, event: isDead ? "dead" : "retry",
              reason: result.error?.slice(0, 240) || "send failed",
              metadata: { job_id: job.id, worker: workerId, attempt: job.attempts },
            });
          }
        } catch (e) {
          // Failsafe — never let one job block others
          stats.failed++;
          await supabase.rpc("mark_outreach_send_result", {
            p_job_id: job.id, p_success: false,
            p_error_msg: e instanceof Error ? e.message.slice(0, 400) : "worker exception",
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, worker: workerId, stats, elapsed_ms: Date.now() - startedAt }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("worker fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown", stats }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
