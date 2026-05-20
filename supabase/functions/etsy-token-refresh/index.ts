// Scheduled (every 6h) proactive Etsy OAuth token refresh.
// Refreshes if access token has <12h life remaining; always logs to etsy_token_refresh_log.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REFRESH_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12h

async function refreshEtsyToken(clientId: string, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });
  const r = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`etsy_refresh_${r.status}: ${txt.slice(0, 250)}`);
  return JSON.parse(txt) as { access_token: string; refresh_token: string; expires_in: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  let success = false, refreshed = false, expiresAtIso: string | null = null, errorMsg: string | null = null;

  try {
    const keystring = Deno.env.get("ETSY_API_KEY") ?? "";
    if (!keystring) throw new Error("ETSY_API_KEY missing");
    const clientId = keystring.split(":")[0];

    const { data: row, error } = await sb
      .from("etsy_oauth_tokens").select("*").eq("key", "default").maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("No etsy_oauth_tokens row — click Connect Etsy in admin");

    const expiresAt = new Date(row.expires_at as string).getTime();
    const msLeft = expiresAt - Date.now();
    expiresAtIso = new Date(expiresAt).toISOString();

    if (msLeft < REFRESH_THRESHOLD_MS) {
      const tok = await refreshEtsyToken(clientId, row.refresh_token as string);
      const newExp = new Date(Date.now() + tok.expires_in * 1000).toISOString();
      const { error: upErr } = await sb.from("etsy_oauth_tokens").update({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: newExp,
        updated_at: new Date().toISOString(),
      }).eq("key", "default");
      if (upErr) throw upErr;
      refreshed = true;
      expiresAtIso = newExp;
    }
    success = true;
  } catch (e) {
    errorMsg = (e as Error).message;
  }

  await sb.from("etsy_token_refresh_log").insert({
    success, refreshed, expires_at: expiresAtIso, error: errorMsg,
  });

  // Best-effort SMS to Matt on failure
  if (!success) {
    try {
      const { sendSMS } = await import("../_shared/twilio.ts");
      const admin = Deno.env.get("ADMIN_PHONE");
      const from = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (admin && from) await sendSMS(admin, from, `[Etsy] Token refresh failed: ${errorMsg?.slice(0,120)}`, "etsy");
    } catch (_) { /* ignore */ }
  }

  return new Response(JSON.stringify({ ok: success, refreshed, expires_at: expiresAtIso, error: errorMsg }), {
    status: success ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
