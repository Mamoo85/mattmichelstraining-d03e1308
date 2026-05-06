// outreach-queue-action — Admin action endpoint for the approval queue.
// Approves a single draft (or batch) and dispatches it through the right channel.
//
// POST { action: 'approve' | 'reject' | 'batch_approve', id?: uuid, ids?: uuid[], reason?: string }
//
// On approve: updates status='approved', then sends via Resend (email) or Twilio (sms).
// On success: status='sent', sent_at=now(), send_result captured.
// On failure: status='failed', send_result captures error.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function dispatchOne(sb: any, row: any, approver: string) {
  if (!row || row.status !== "pending" && row.status !== "approved") {
    return { ok: false, error: `bad_status:${row?.status}` };
  }

  let sendResult: any = null;
  let success = false;

  try {
    if (row.channel === "email") {
      if (!row.recipient_email) {
        // Queue for manual fulfillment if no recipient — Matt will paste address
        await sb.from("outreach_approval_queue").update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: approver,
          send_result: { note: "approved_pending_recipient" },
        }).eq("id", row.id);
        return { ok: true, dispatched: false, note: "no_recipient_email" };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
          to: [row.recipient_email],
          subject: row.draft_subject || "Quick question",
          html: row.draft_body.replace(/\n/g, "<br>"),
          text: row.draft_body,
          reply_to: "matt@detroitwebagent.com",
        }),
      });
      sendResult = await res.json().catch(() => ({}));
      success = res.ok;
    } else if (row.channel === "sms") {
      if (!row.recipient_phone) {
        await sb.from("outreach_approval_queue").update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: approver,
          send_result: { note: "approved_pending_phone" },
        }).eq("id", row.id);
        return { ok: true, dispatched: false, note: "no_recipient_phone" };
      }
      sendResult = await sendSMS(row.recipient_phone, TWILIO_FROM, row.draft_body, "approval_queue_dispatch");
      success = (sendResult as any)?.ok !== false;
    } else {
      // Other channels (postcard/fax/linkedin) just mark approved — fulfilled by their own runners
      await sb.from("outreach_approval_queue").update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: approver,
        send_result: { note: `channel_${row.channel}_queued_for_runner` },
      }).eq("id", row.id);
      return { ok: true, dispatched: false, note: `${row.channel}_queued` };
    }
  } catch (e) {
    sendResult = { error: e instanceof Error ? e.message : String(e) };
    success = false;
  }

  await sb.from("outreach_approval_queue").update({
    status: success ? "sent" : "failed",
    approved_at: new Date().toISOString(),
    approved_by: approver,
    sent_at: success ? new Date().toISOString() : null,
    send_result: sendResult,
  }).eq("id", row.id);

  return { ok: success, dispatched: success, send_result: sendResult };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body.action;
    const approver = user.email || user.id;

    if (action === "reject") {
      const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (!ids.length) return new Response(JSON.stringify({ error: "no_ids" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await sb.from("outreach_approval_queue").update({
        status: "rejected",
        rejected_reason: body.reason || "manual_reject",
      }).in("id", ids).eq("status", "pending");
      return new Response(JSON.stringify({ ok: true, rejected: ids.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "approve" || action === "batch_approve") {
      const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (!ids.length) return new Response(JSON.stringify({ error: "no_ids" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: rows, error } = await sb.from("outreach_approval_queue")
        .select("*")
        .in("id", ids)
        .eq("status", "pending");
      if (error) throw error;

      const dispatchResults = [];
      for (const row of rows || []) {
        const r = await dispatchOne(sb, row, approver);
        dispatchResults.push({ id: row.id, ...r });
      }

      const sent = dispatchResults.filter((r) => r.dispatched).length;
      const queued = dispatchResults.filter((r) => !r.dispatched && (r as any).ok).length;
      const failed = dispatchResults.filter((r) => !(r as any).ok).length;

      return new Response(JSON.stringify({ ok: true, sent, queued, failed, results: dispatchResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach-queue-action] FAIL:", msg);
    await logError({ source: "edge_function", function_name: "outreach-queue-action", severity: "error", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
