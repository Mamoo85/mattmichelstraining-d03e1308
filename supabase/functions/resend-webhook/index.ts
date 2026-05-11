// resend-webhook
// Receives email.opened / email.clicked / email.bounced / email.complained events
// from Resend and stamps email_send_log with the corresponding timestamps.
//
// Resend webhook setup: https://resend.com/webhooks
// URL to paste: https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/resend-webhook
// Signing secret (RESEND_WEBHOOK_SECRET) is verified via the svix-signature header.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

async function verifySvix(rawBody: string, headers: Headers): Promise<boolean> {
  // If no secret configured, fail open in non-prod-safe way (log only).
  if (!WEBHOOK_SECRET) {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned payload");
    return true;
  }
  const svixId = headers.get("svix-id");
  const svixTs = headers.get("svix-timestamp");
  const svixSig = headers.get("svix-signature");
  if (!svixId || !svixTs || !svixSig) return false;

  // Resend signs as: v1,<base64(hmac-sha256(secret_bytes, "id.timestamp.body"))>
  // Secret format is "whsec_<base64>"; strip the prefix and decode.
  const secretB64 = WEBHOOK_SECRET.startsWith("whsec_") ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  } catch {
    keyBytes = new TextEncoder().encode(secretB64);
  }
  const toSign = `${svixId}.${svixTs}.${rawBody}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(toSign));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature header may contain multiple "v1,sig v1,sig2" pairs
  return svixSig.split(" ").some((pair) => {
    const [, sig] = pair.split(",");
    return sig === expected;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const ok = await verifySvix(rawBody, req.headers);
  if (!ok) {
    console.error("[resend-webhook] signature_verification_failed");
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const type: string = payload?.type || "";
  const emailId: string | undefined = payload?.data?.email_id || payload?.data?.id;
  if (!emailId) {
    console.warn("[resend-webhook] event missing email_id", { type });
    return new Response(JSON.stringify({ ok: true, skipped: "no_email_id" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Map event → column
  const FIELD_MAP: Record<string, string> = {
    "email.opened": "opened_at",
    "email.clicked": "clicked_at",
    "email.bounced": "bounced_at",
    "email.complained": "complained_at",
    // Optional extras — silently ignored if columns don't exist:
    "email.delivered": "delivered_at",
    "email.delivery_delayed": "delayed_at",
  };
  const column = FIELD_MAP[type];
  if (!column) {
    return new Response(JSON.stringify({ ok: true, skipped: "untracked_event", type }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const stamp = payload?.created_at || new Date().toISOString();
  // Only stamp the FIRST occurrence (don't overwrite earlier opens with later opens).
  const { error, count } = await supabase
    .from("email_send_log")
    .update({ [column]: stamp }, { count: "exact" })
    .eq("message_id", emailId)
    .is(column, null);

  if (error) {
    // Ignore "column does not exist" for optional extras like delivered_at.
    if (/column .* does not exist/i.test(error.message)) {
      return new Response(JSON.stringify({ ok: true, skipped: "column_missing", column }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[resend-webhook] update_failed", { emailId, type, error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, type, emailId, updated: count ?? 0 }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
