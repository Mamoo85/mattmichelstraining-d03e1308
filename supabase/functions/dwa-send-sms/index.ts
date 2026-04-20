// dwa-send-sms — Admin-only endpoint for the SMS Inbox in /dwa-admin.
// Sends an SMS from the DWA work number (+13139921219) to a recipient
// and logs it to system_comms_log so the conversation thread updates instantly.
//
// Auth: requires a valid Supabase JWT belonging to a user with the
// agency-admin role (matches AgencyAdminRoute on the frontend).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Loose E.164 normalizer — accepts (313) 555-1234, 313-555-1234, 3135551234, +13135551234
function normalizeUS(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // 1. Auth — verify the caller is logged in
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing bearer token" });
    }
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await sbAuth.auth.getUser();
    if (userError || !userData?.user) {
      return json(401, { error: "Invalid session" });
    }

    // 2. Check agency-admin role via service-role client (bypasses RLS)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "agency_admin"])
      .maybeSingle();
    if (!roleRow) {
      return json(403, { error: "Admin role required" });
    }

    // 3. Parse + validate body
    const { to, body } = await req.json() as { to?: string; body?: string };
    if (!to || !body) {
      return json(400, { error: "Missing 'to' or 'body'" });
    }
    const toE164 = normalizeUS(to);
    if (!toE164) {
      return json(400, { error: `Invalid US phone number: ${to}` });
    }
    if (body.length > 1500) {
      return json(400, { error: "Message exceeds 1500 chars" });
    }

    // 4. Send via shared Twilio helper (handles opt-out scrub + logging).
    //    "dead_lead_reply" is whitelisted to bypass quiet hours since this is
    //    a manual reply to an inbound conversation — same TCPA exemption.
    const result = await sendSMS(
      toE164,
      TWILIO_PHONE_NUMBER,
      body,
      "dwa_admin_reply",
      false,
      { bypassQuietHours: true }
    );

    if (!result.success) {
      return json(result.skipped ? 200 : 500, {
        success: false,
        skipped: result.skipped ?? false,
        error: result.error,
      });
    }

    return json(200, { success: true, sid: result.sid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dwa-send-sms] error:", msg);
    return json(500, { error: msg });
  }
});
