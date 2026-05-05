// inbound-sms-relay — Twilio SMS webhook for +13139921219 (DWA work number).
//
// Behavior:
// 1. Logs every inbound message to system_comms_log so the admin inbox renders threads.
// 2. If the message is from Matt's personal cell:
//    - "A" or "Y"        → approve latest pending draft and SEND it
//    - "E <new text>"    → edit + send latest pending draft
//    - "N"               → cancel latest pending draft (nothing sent)
// 3. Otherwise forwards a preview to Matt's personal cell so he sees the reply on his phone.
//
// Post-send hook: when an approved draft has metadata.source === "prospect_nudge",
// stamps prospect_nudges (nudge_sent_at, nudge_count, last_nudge_sid) so the
// StatusCallback can match deliverability.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const MATT_PERSONAL = Deno.env.get("MATT_PERSONAL_PHONE") || "+13138064952";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function normalize(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return phone;
}

serve(async (req) => {
  const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

  if (req.method !== "POST") {
    return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") || "Unknown";
    const to = params.get("To") || TWILIO_PHONE_NUMBER;
    const body = params.get("Body") || "";
    const messageSid = params.get("MessageSid") || undefined;

    console.log(`[inbound-sms-relay] SMS from ${from} → ${to}: ${body}`);

    const sb =
      SUPABASE_URL && SUPABASE_SERVICE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        : null;

    // 1. Log inbound message
    if (sb) {
      await sb
        .from("system_comms_log")
        .insert({
          channel: "sms",
          product: "inbound",
          recipient: to,
          body_preview: body.slice(0, 1000),
          status: "inbound",
          provider_id: messageSid,
          metadata: { from, direction: "inbound" },
        })
        .then(({ error }) => {
          if (error) console.error("[inbound-sms-relay] log insert error:", error.message);
        });
    }

    // 2. Approval/edit/cancel routing — only when Matt himself texts in
    const fromNormalized = normalize(from);
    const trimmed = body.trim();
    const isApprove = /^[ay]$/i.test(trimmed); // Y or A both approve
    const isCancel = /^n$/i.test(trimmed);
    const editMatch = trimmed.match(/^e\s+([\s\S]+)$/i);
    const isEdit = !!editMatch;

    if (sb && fromNormalized === MATT_PERSONAL && (isApprove || isEdit || isCancel)) {
      const { data: pending } = await sb
        .from("sms_reply_drafts")
        .select("id, phone, draft_body, metadata")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pending) {
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          "No pending draft to send. Type your reply normally and I'll forward it.",
          "dwa_admin_reply",
          false,
          { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      // Cancel branch — no SMS to recipient, just mark cancelled
      if (isCancel) {
        await sb
          .from("sms_reply_drafts")
          .update({ status: "cancelled" })
          .eq("id", (pending as any).id);
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          `❌ Cancelled draft for ${(pending as any).phone}. Nothing sent.`,
          "dwa_admin_reply",
          false,
          { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      const finalBody = isEdit ? editMatch![1].trim() : (pending as any).draft_body;
      const targetPhone = (pending as any).phone;
      const meta = (pending as any).metadata ?? {};
      const isProspectNudge = meta.source === "prospect_nudge";
      const product = isProspectNudge ? "dwa_prospect_nudge" : undefined;

      // Send via dwa-send-sms so it logs to system_comms_log + checks opt-outs
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/dwa-send-sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: targetPhone, body: finalBody, product }),
      });

      const result = await sendRes.json().catch(() => ({}));
      const ok = sendRes.ok && result?.success !== false;

      await sb
        .from("sms_reply_drafts")
        .update({
          status: ok ? (isEdit ? "edited" : "sent") : "failed",
          sent_at: ok ? new Date().toISOString() : null,
          draft_body: finalBody,
        })
        .eq("id", (pending as any).id);

      // Post-send hook: stamp prospect_nudges so StatusCallback can match
      if (ok && isProspectNudge && meta.prospect_id) {
        const sid = Array.isArray(result?.sids) && result.sids.length > 0 ? result.sids[0] : null;
        const { data: existing } = await sb
          .from("prospect_nudges")
          .select("nudge_count")
          .eq("id", meta.prospect_id)
          .maybeSingle();
        await sb
          .from("prospect_nudges")
          .update({
            nudge_sent_at: new Date().toISOString(),
            nudge_count: ((existing as any)?.nudge_count ?? 0) + 1,
            last_nudge_sid: sid,
            last_nudge_status: "queued",
            last_nudge_error: null,
          })
          .eq("id", meta.prospect_id);
      }

      await sendSMS(
        MATT_PERSONAL,
        TWILIO_PHONE_NUMBER,
        ok
          ? `✅ Sent to ${targetPhone}: "${finalBody.slice(0, 120)}"`
          : `❌ Send failed to ${targetPhone}. ${result?.error || sendRes.status}`,
        "dwa_admin_reply",
        false,
        { bypassQuietHours: true }
      );

      return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
    }

    // 3. Fixer SMS commands — only from Matt's personal cell
    if (sb && fromNormalized === MATT_PERSONAL) {
      const cmd = trimmed.toUpperCase();

      if (cmd === "FIX") {
        // Trigger watchdog immediately
        fetch(`${SUPABASE_URL}/functions/v1/code-fixer-watchdog`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger: "sms_command" }),
        }).catch(() => {/* fire-and-forget */});
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          "🔧 Fixer triggered — you'll get a summary SMS when it finishes.",
          "fixer",
          false,
          { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      if (cmd === "ERRORS" || cmd === "STATUS") {
        const { data } = await sb
          .from("error_logs")
          .select("source,function_name,severity,error_message,created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        const lines = (data || []).map(
          (e: { severity: string; source: string; function_name: string | null; error_message: string }, i: number) =>
            `${i + 1}. [${e.severity}] ${e.source}/${e.function_name || "?"}: ${(e.error_message || "").slice(0, 55)}`
        );
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          lines.length ? `Last ${lines.length} errors:\n${lines.join("\n")}` : "No recent errors.",
          "fixer",
          false,
          { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      if (cmd === "FIXED?") {
        const { data } = await sb
          .from("fixer_runs")
          .select("triggered_by,errors_fixed,errors_escalated,errors_failed,summary,completed_at")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const msg = data
          ? `Last fixer run (${(data as { triggered_by: string; errors_fixed: number; errors_escalated: number; errors_failed: number; summary: string }).triggered_by}): ${(data as { triggered_by: string; errors_fixed: number; errors_escalated: number; errors_failed: number; summary: string }).errors_fixed} fixed, ${(data as { triggered_by: string; errors_fixed: number; errors_escalated: number; errors_failed: number; summary: string }).errors_escalated} escalated, ${(data as { triggered_by: string; errors_fixed: number; errors_escalated: number; errors_failed: number; summary: string }).errors_failed} failed.`
          : "No fixer runs recorded yet.";
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          msg,
          "fixer",
          false,
          { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      if (cmd.startsWith("DEPLOY ")) {
        const fnName = trimmed.slice(7).trim();
        const safe = /^[a-z0-9-]{2,80}$/.test(fnName);
        if (!safe) {
          await sendSMS(MATT_PERSONAL, TWILIO_PHONE_NUMBER, `❌ Invalid function name: "${fnName}". Use lowercase letters, digits, dashes only.`, "deploy", false, { bypassQuietHours: true });
          return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
        }
        const ghToken = Deno.env.get("GITHUB_PAT") || Deno.env.get("GITHUB_TOKEN");
        if (!ghToken) {
          await sendSMS(MATT_PERSONAL, TWILIO_PHONE_NUMBER, `❌ GITHUB_PAT secret not set. Add it in Lovable Cloud secrets to enable DEPLOY SMS.`, "deploy", false, { bypassQuietHours: true });
          return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
        }
        const dispatchRes = await fetch("https://api.github.com/repos/mamoo85/m2training/actions/workflows/deploy-supabase.yml/dispatches", {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${ghToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main", inputs: { function_name: fnName } }),
        });
        const ok = dispatchRes.status === 204;
        await sendSMS(
          MATT_PERSONAL, TWILIO_PHONE_NUMBER,
          ok
            ? `🚀 Deploying ${fnName}. Watch: github.com/mamoo85/m2training/actions`
            : `❌ Deploy failed (HTTP ${dispatchRes.status}). Check GITHUB_PAT scopes (repo + workflow).`,
          "deploy", false, { bypassQuietHours: true }
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }
    }

    // 4. Callback scheduler — parse "call me at X" from any caller reply
    if (sb && fromNormalized !== MATT_PERSONAL) {
      const callbackMatch = body.match(/call\s+(?:me\s+)?(?:back\s+)?at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (callbackMatch) {
        const timeStr = callbackMatch[1].trim();
        const now = new Date();
        // Parse simple time — default to today, Eastern time approximation (UTC-4)
        const [hourRaw, minRaw] = timeStr.replace(/[apm]/gi, "").split(":").map(Number);
        const isPm = /pm/i.test(timeStr);
        const hour = isPm && hourRaw < 12 ? hourRaw + 12 : (!isPm && hourRaw === 12 ? 0 : hourRaw);
        const scheduledFor = new Date(now);
        scheduledFor.setUTCHours(hour + 4, minRaw || 0, 0, 0); // +4 for ET offset
        if (scheduledFor < now) scheduledFor.setUTCDate(scheduledFor.getUTCDate() + 1);

        await sb.from("callback_reminders").insert({
          caller_number: fromNormalized,
          context: body.slice(0, 200),
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
        }).then(({ error }) => {
          if (error) console.error("[inbound-sms-relay] callback_reminders insert:", error.message);
        });

        await sendSMS(
          fromNormalized,
          TWILIO_PHONE_NUMBER,
          `Got it! Matt will call you back at ${timeStr}. `,
          "missed_call_callback",
          false,
          { bypassQuietHours: true }
        );

        // Also log the reply in missed_call_captures
        await sb.from("missed_call_captures")
          .update({ reply_received: body.slice(0, 500), status: "in_progress" })
          .eq("caller_number", fromNormalized)
          .eq("status", "new");

        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      // Log any caller reply into missed_call_captures
      await sb.from("missed_call_captures")
        .update({ reply_received: body.slice(0, 500), status: "in_progress" })
        .eq("caller_number", fromNormalized)
        .eq("status", "new");
    }

    // 5. Default: forward inbound to Matt's personal cell (existing behavior)
    await sendSMS(
      MATT_PERSONAL,
      TWILIO_PHONE_NUMBER,
      `DWA msg from ${from}: ${body}`,
      "dwa_admin_reply",
      false,
      { bypassQuietHours: true }
    );
  } catch (e: unknown) {
    console.error("[inbound-sms-relay] Error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
});
