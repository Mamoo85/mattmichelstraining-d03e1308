// etsy-oauth-refresh — refreshes the Etsy OAuth token every 55 minutes.
// Called by pg_cron; also safe to trigger manually via POST {}.
//
// Validity-window guard: if the current token still has >10 minutes remaining,
// this run is a cheap no-op (one DB read, no Etsy API call). This lets the
// cron fire frequently without hammering Etsy's OAuth endpoint.
//
// If refresh fails → SMS Matt immediately (Etsy pipeline is broken).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refresh if token expires within this many milliseconds.
// 10 min guard = safe headroom for the 55-min cron cadence.
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ETSY_API_KEY        = Deno.env.get("ETSY_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Allow force=true to bypass the validity-window guard (for manual recovery)
  let forceRefresh = false;
  try {
    const body = await req.json().catch(() => ({}));
    forceRefresh = body?.force === true;
  } catch { /* ignore body parse errors */ }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Read latest etsy_oauth_tokens row — include expires_at for validity check
    const { data: row, error: fetchErr } = await sb
      .from("etsy_oauth_tokens")
      .select("id, refresh_token, shop_id, expires_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !row || !row.refresh_token) {
      const msg = "⚠️ Etsy OAuth: no refresh token found";
      await logError({
        source: "etsy-oauth-refresh",
        function_name: "etsy-oauth-refresh",
        severity: "error",
        error_message: msg,
      });
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "etsy-oauth-refresh");
      return new Response(
        JSON.stringify({ ok: false, reason: "no_token" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // 2. Validity-window guard — skip if token is still good for >10 min
    if (!forceRefresh && row.expires_at) {
      const expiresAt = new Date(row.expires_at).getTime();
      const msUntilExpiry = expiresAt - Date.now();
      if (msUntilExpiry > REFRESH_THRESHOLD_MS) {
        const minutesLeft = Math.round(msUntilExpiry / 60_000);
        return new Response(
          JSON.stringify({
            ok: true,
            refreshed: false,
            skipped: true,
            reason: "token_still_valid",
            minutes_remaining: minutesLeft,
            expires_at: row.expires_at,
            shop_id: row.shop_id,
          }),
          { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. POST refresh request to Etsy
    const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     ETSY_API_KEY,
        refresh_token: row.refresh_token,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!tokenRes.ok) {
      const msg = `🚨 Etsy OAuth refresh FAILED: HTTP ${tokenRes.status}`;
      await logError({
        source: "etsy-oauth-refresh",
        function_name: "etsy-oauth-refresh",
        severity: "critical",
        error_message: `${msg} — shop_id: ${row.shop_id}`,
      });
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "etsy-oauth-refresh");
      return new Response(
        JSON.stringify({ ok: false, reason: "refresh_failed", status: tokenRes.status }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse new tokens
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, token_type } = tokenData;

    const expires_at = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    // 5. UPDATE the existing row
    const { error: updateErr } = await sb
      .from("etsy_oauth_tokens")
      .update({
        access_token,
        refresh_token,   // Etsy rotates the refresh token on each use
        expires_at,
        token_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) {
      throw new Error(`DB update failed: ${updateErr.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, refreshed: true, expires_at, shop_id: row.shop_id }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = `🚨 Etsy OAuth refresh exception: ${(e as Error)?.message ?? String(e)}`;
    try {
      await logError({
        source: "etsy-oauth-refresh",
        function_name: "etsy-oauth-refresh",
        severity: "critical",
        error_message: msg,
      });
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "etsy-oauth-refresh");
    } catch { /* best-effort SMS */ }

    return new Response(
      JSON.stringify({ ok: false, reason: "exception", error: (e as Error)?.message ?? String(e) }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
