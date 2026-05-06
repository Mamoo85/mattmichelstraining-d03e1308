// dwa-resend-sms — Idempotent, dedup-aware SMS resend endpoint.
//
// Three input modes (priority order):
//   1. { source_message_id }                  → fetch body_full from system_comms_log
//   2. { template_id, vars }                  → render from sms-templates registry
//   3. { body }                               → raw body (last resort)
//
// Safety:
//   - Idempotency-Key header → cached response replayed on repeat (24h TTL)
//   - body_hash dedup → blocks identical resends to same recipient within 24h (overridable with force=true)
//   - Twilio 5xx / network errors → exponential backoff retry (3 attempts)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, computeBodyHash } from "../_shared/twilio.ts";
import { renderTemplate } from "../_shared/sms-templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeUS(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(digits)) return digits;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return null;
}

interface ResendBody {
  recipient: string;
  source_message_id?: string;
  template_id?: string;
  vars?: Record<string, string>;
  body?: string;
  product?: string;
  force?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // -- Auth: admin user JWT or service-role bypass --
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });
    const token = authHeader.slice(7).trim();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (token !== SUPABASE_SERVICE_KEY) {
      const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await sbAuth.auth.getUser();
      if (userError || !userData?.user) return json(401, { error: "Invalid session" });
      const { data: roleRow } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .in("role", ["admin", "agency_admin"])
        .maybeSingle();
      if (!roleRow) return json(403, { error: "Admin role required" });
    }

    // -- Idempotency replay --
    const idemKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (idemKey) {
      // Opportunistic purge of stale keys (cheap)
      sb.rpc("purge_expired_idempotency_keys").then(() => {}, () => {});
      const { data: cached } = await sb
        .from("sms_idempotency_keys")
        .select("response, expires_at")
        .eq("key", idemKey)
        .maybeSingle();
      if (cached && new Date(cached.expires_at as string) > new Date()) {
        return json(200, { ...(cached.response as Record<string, unknown>), replayed: true });
      }
    }

    // -- Parse + validate --
    const payload = (await req.json()) as ResendBody;
    if (!payload.recipient) return json(400, { error: "Missing 'recipient'" });
    const recipient = normalizeUS(payload.recipient);
    if (!recipient) return json(400, { error: `Invalid US phone: ${payload.recipient}` });

    // -- Resolve body (3 modes) --
    let body: string | null = null;
    let product = payload.product ?? "dwa_admin_reply";
    let source: "source_message_id" | "template_id" | "body" = "body";

    if (payload.source_message_id) {
      const { data: src } = await sb
        .from("system_comms_log")
        .select("body_full, body_preview, product, recipient")
        .eq("id", payload.source_message_id)
        .maybeSingle();
      if (!src) return json(404, { error: "source_message_id not found" });
      body = (src.body_full as string | null) ?? (src.body_preview as string | null);
      if (!body) return json(400, { error: "Source message has no stored body — pick a template instead" });
      product = (src.product as string | null) ?? product;
      source = "source_message_id";
    } else if (payload.template_id) {
      try {
        const r = renderTemplate(payload.template_id, payload.vars ?? {});
        body = r.body;
        product = r.product;
        source = "template_id";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json(400, { error: `Template render failed: ${msg}` });
      }
    } else if (payload.body) {
      body = payload.body;
    } else {
      return json(400, { error: "Provide one of: source_message_id, template_id, body" });
    }

    if (body.length > 8000) return json(400, { error: "Body exceeds 8000 chars" });

    // -- Dedup check (24h window) --
    const bodyHash = await computeBodyHash(recipient, body, product);
    if (!payload.force) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dup } = await sb
        .from("system_comms_log")
        .select("id, created_at, status")
        .eq("recipient", recipient)
        .eq("body_hash", bodyHash)
        .eq("status", "sent")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dup) {
        const response = {
          success: false,
          skipped: true,
          reason: "duplicate_within_24h",
          existing_id: dup.id,
          existing_sent_at: dup.created_at,
          source,
        };
        if (idemKey) await cacheResponse(sb, idemKey, recipient, bodyHash, response);
        return json(200, response);
      }
    }

    // -- Send with retry (3 attempts, exponential backoff on transient errors) --
    const backoffsMs = [500, 1500, 4000];
    let attempt = 0;
    let lastError: string | undefined;
    let result: Awaited<ReturnType<typeof sendSMS>> | undefined;
    while (attempt < backoffsMs.length) {
      result = await sendSMS(
        recipient,
        TWILIO_PHONE_NUMBER,
        body,
        product,
        false,
        { bypassQuietHours: true },
      );
      if (result.success || result.skipped) break;
      // Non-retriable: bad creds, validation, opt-out (already returns skipped). Retry only on Twilio server errors.
      const errStr = (result.error || "").toLowerCase();
      const transient =
        errStr.includes("timeout") ||
        errStr.includes("network") ||
        errStr.includes("fetch") ||
        /\b5\d\d\b/.test(errStr);
      lastError = result.error;
      if (!transient) break;
      await new Promise((r) => setTimeout(r, backoffsMs[attempt]));
      attempt++;
    }

    const response = result?.success
      ? { success: true, sid: result.sid, source, attempts: attempt + 1, body_hash: bodyHash }
      : {
          success: false,
          skipped: result?.skipped ?? false,
          error: result?.error ?? lastError ?? "send_failed",
          attempts: attempt + 1,
          source,
        };

    if (idemKey) await cacheResponse(sb, idemKey, recipient, bodyHash, response);
    return json(response.success ? 200 : (response.skipped ? 200 : 500), response);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dwa-resend-sms] error:", msg);
    return json(500, { error: msg });
  }
});

async function cacheResponse(
  sb: ReturnType<typeof createClient>,
  key: string,
  recipient: string,
  bodyHash: string,
  response: Record<string, unknown>,
) {
  try {
    await sb.from("sms_idempotency_keys").upsert(
      { key, recipient, body_hash: bodyHash, response },
      { onConflict: "key" },
    );
  } catch (e) {
    console.warn("[dwa-resend-sms] cache write failed:", e);
  }
}
