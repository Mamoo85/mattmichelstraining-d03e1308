// inbound-sms-relay — Twilio SMS webhook for +13139921219 (DWA work number).
//
// Behavior:
// 1. Logs every inbound message to system_comms_log so the admin inbox renders threads.
// 2. If the message is from Matt's personal cell and starts with "A" or "E ..." → treats
//    it as approval/edit of the latest pending sms_reply_drafts entry and SENDS that to
//    the original contractor.
// 3. Otherwise forwards a preview to Matt's personal cell so he sees the reply on his phone.

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

    // 2. Approval/edit routing — only when Matt himself texts in
    const fromNormalized = normalize(from);
    const trimmed = body.trim();
    const isApprove = /^a$/i.test(trimmed);
    const editMatch = trimmed.match(/^e\s+([\s\S]+)$/i);
    const isEdit = !!editMatch;

    if (sb && fromNormalized === MATT_PERSONAL && (isApprove || isEdit)) {
      // Find the latest pending OR previously-failed draft (any phone — most
      // recent wins). Including "failed" lets Matt simply text "A" again
      // after a transient Twilio error.
      const { data: pending } = await sb
        .from("sms_reply_drafts")
        .select("id, phone, draft_body")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pending) {
        await sendSMS(
          MATT_PERSONAL,
          TWILIO_PHONE_NUMBER,
          "No pending draft to send. Type your reply normally and I'll forward it.",
          "draft_approval"
        );
        return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
      }

      const finalBody = isEdit ? editMatch![1].trim() : (pending as any).draft_body;
      const targetPhone = (pending as any).phone;

      // Send via dwa-send-sms so it logs to system_comms_log + checks opt-outs
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/dwa-send-sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: targetPhone, body: finalBody }),
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

      await sendSMS(
        MATT_PERSONAL,
        TWILIO_PHONE_NUMBER,
        ok
          ? `✅ Sent to ${targetPhone}: "${finalBody.slice(0, 120)}"`
          : `❌ Send failed to ${targetPhone}. ${result?.error || sendRes.status}`,
        "draft_approval"
      );

      return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
    }

    // 3. Default: forward inbound to Matt's personal cell (existing behavior)
    await sendSMS(
      MATT_PERSONAL,
      TWILIO_PHONE_NUMBER,
      `DWA msg from ${from}: ${body}`,
      "sms_relay"
    );
  } catch (e: unknown) {
    console.error("[inbound-sms-relay] Error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
});
