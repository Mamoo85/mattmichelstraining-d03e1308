/**
 * Shared error logging helper.
 * Writes silent failures (Twilio, Resend, Stripe, cron) to the error_logs table.
 * If severity='critical', also fires an admin SMS via the shared twilio helper.
 *
 * Use throughout edge functions to make silent failures observable in DWA Admin.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

export type ErrorSource = "twilio" | "resend" | "stripe" | "cron" | "edge_function" | "ai";
export type ErrorSeverity = "warn" | "error" | "critical";

export interface ErrorLogInput {
  source: ErrorSource;
  function_name?: string;
  severity?: ErrorSeverity;
  recipient?: string | null;
  payload?: unknown;
  error_message: string;
  http_status?: number | null;
}

/**
 * Log an error to error_logs. Fire-and-forget — never throws.
 * Critical errors also fire an admin SMS.
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  const severity = input.severity ?? "error";
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[error-log] Missing supabase creds; cannot write error_logs row");
      return;
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let alertedAdmin = false;

    // Critical → SMS Matt before insert so we know even if DB is down
    if (severity === "critical") {
      try {
        const credentials = btoa(
          `${Deno.env.get("TWILIO_ACCOUNT_SID") || ""}:${Deno.env.get("TWILIO_AUTH_TOKEN") || ""}`
        );
        const body =
          `🚨 DWA CRITICAL [${input.source}/${input.function_name ?? "unknown"}]: ` +
          `${input.error_message.slice(0, 200)}`;
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get("TWILIO_ACCOUNT_SID") || ""}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE, Body: body }),
            signal: AbortSignal.timeout(8000),
          }
        );
        alertedAdmin = true;
      } catch (e) {
        console.error("[error-log] critical SMS to admin failed:", e);
      }
    }

    await sb.from("error_logs").insert({
      source: input.source,
      function_name: input.function_name ?? null,
      severity,
      recipient: input.recipient ?? null,
      payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : null,
      error_message: input.error_message.slice(0, 4000),
      http_status: input.http_status ?? null,
      alerted_admin: alertedAdmin,
    });
  } catch (e) {
    // Never throw from a logger
    console.error("[error-log] failed to write error_logs row:", e);
  }
}
