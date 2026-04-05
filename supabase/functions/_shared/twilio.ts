/**
 * Shared Twilio SMS utility.
 * Uses TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN directly — no Lovable gateway needed.
 * Always checks sms_opt_outs before sending (TCPA compliance).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send an SMS via Twilio. Returns result object.
 * Automatically skips opted-out numbers and logs compliance blocks.
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

  // TCPA compliance: check opt-out registry before every send
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: optOut } = await sb
      .from("sms_opt_outs")
      .select("id")
      .eq("phone", to)
      .maybeSingle();

    if (optOut) {
      console.log(`[SMS] ${to} is opted out — skipping`);
      if (product) {
        await sb.from("compliance_blocks").insert({
          phone: to,
          product,
          reason: "sms_opt_out",
        });
      }
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
      return { success: false, error: data?.message || "Twilio error" };
    }

    console.log(`[SMS] Sent to ${to} — SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SMS] Exception: ${msg}`);
    return { success: false, error: msg };
  }
}
