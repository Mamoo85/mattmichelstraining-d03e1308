/**
 * Shared Twilio SMS utility.
 * Uses TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN directly — no Lovable gateway needed.
 * Always checks sms_opt_outs before sending (TCPA compliance).
 * Logs every send/skip/fail to system_comms_log (fire-and-forget).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Admin phone — use env var, fall back to Matt's number
export const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send an SMS via Twilio. Returns result object.
 * Automatically skips opted-out numbers and logs compliance blocks.
 * Logs all sends/skips/failures to system_comms_log (fire-and-forget).
 */
export async function sendSMS(
  to: string,
  from: string,
  body: string,
  product?: string
): Promise<SMSResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("[SMS] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set");
    return { success: false, error: "Missing Twilio credentials" };
  }

  const sb = SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

  // TCPA compliance: check opt-out registry before every send
  if (sb) {
    const { data: optOut } = await sb
      .from("sms_opt_outs")
      .select("id")
      .eq("phone", to)
      .maybeSingle();

    if (optOut) {
      console.log(`[SMS] ${to} is opted out — skipping`);
      if (product) {
        Promise.resolve(sb.from("compliance_blocks").insert({ phone: to, product, reason: "sms_opt_out" })).catch(() => {});
      }
      // Log skip to comms log (fire-and-forget)
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        status: "skipped",
        error_message: "sms_opt_out",
      })).catch(() => {});
      return { success: false, skipped: true };
    }
  }

  try {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error(`[SMS] Twilio error ${res.status}: ${JSON.stringify(data)}`);
      // Log failure (fire-and-forget)
      if (sb) {
        Promise.resolve(sb.from("system_comms_log").insert({
          channel: "sms",
          product: product ?? null,
          recipient: to,
          body_preview: body.slice(0, 200),
          status: "failed",
          error_message: data?.message || `HTTP ${res.status}`,
          metadata: { twilio_code: data?.code },
        })).catch(() => {});
      }
      return { success: false, error: data?.message || "Twilio error" };
    }

    console.log(`[SMS] Sent to ${to} — SID: ${data.sid}`);
    // Log success (fire-and-forget)
    if (sb) {
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        status: "sent",
        provider_id: data.sid,
        metadata: { from },
      })).catch(() => {});
    }
    return { success: true, sid: data.sid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SMS] Exception: ${msg}`);
    // Log exception (fire-and-forget)
    if (sb) {
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        status: "failed",
        error_message: msg,
      })).catch(() => {});
    }
    return { success: false, error: msg };
  }
}
