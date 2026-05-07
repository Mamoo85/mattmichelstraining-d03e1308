// Backend Claim/Action handler for Trade Radar dashboards.
// Token-based dashboard users are anon (no auth.jwt email), so RLS blocks
// direct upserts. This function validates dashboard access (native token,
// HMAC signed token, or email match) and performs the action with the
// service-role client.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.190.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const VALID_STATUSES = new Set(["new", "called", "pass", "snoozed", "won", "lost"]);
const TABLE: Record<string, string> = {
  trade: "trade_radar_lead_actions",
  mortgage: "mortgage_radar_lead_actions",
};
const CLIENT_TABLE: Record<string, string> = {
  trade: "trade_radar_clients",
  mortgage: "mortgage_radar_clients",
};

async function verifySignedToken(email: string, token: string): Promise<boolean> {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const tokenB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  let provided: Uint8Array;
  try { provided = decode(sigB64); } catch { return false; }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64)));
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  if (diff !== 0) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decode(tokenB64)));
    return payload.email?.toLowerCase() === email.toLowerCase().trim() &&
      payload.exp && payload.exp >= Date.now();
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const product = String(body.product || "trade").toLowerCase();
    const leadId = String(body.lead_id || "").trim();
    const clientId = String(body.client_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const token = String(body.token || "").trim();
    const status = String(body.status || "called").trim();
    const snoozeUntil = body.snooze_until ? String(body.snooze_until) : null;

    if (!TABLE[product]) {
      return new Response(JSON.stringify({ error: "invalid_product" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!leadId || !clientId) {
      return new Response(JSON.stringify({ error: "missing_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_STATUSES.has(status)) {
      return new Response(JSON.stringify({ error: "invalid_status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller owns this client_id via one of:
    //   (a) native dashboard_token match
    //   (b) HMAC signed token + email
    //   (c) email matches client row
    const { data: clientRow, error: clientErr } = await sb
      .from(CLIENT_TABLE[product])
      .select("id, email, dashboard_token, active")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !clientRow) {
      return new Response(JSON.stringify({ error: "client_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authorized = false;
    if (token && (clientRow as any).dashboard_token && token === (clientRow as any).dashboard_token) {
      authorized = true;
    } else if (token && email && (clientRow as any).email?.toLowerCase() === email) {
      authorized = await verifySignedToken(email, token);
    } else if (email && (clientRow as any).email?.toLowerCase() === email) {
      authorized = true; // email-only fallback (matches dashboard's last-resort path)
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertErr } = await sb
      .from(TABLE[product])
      .upsert({
        client_id: clientId,
        lead_id: leadId,
        status,
        snooze_until: snoozeUntil,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,lead_id" });

    if (upsertErr) {
      console.error("[claim-trade-radar-lead] upsert failed", upsertErr);
      return new Response(JSON.stringify({ error: "save_failed", detail: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, status, snooze_until: snoozeUntil }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[claim-trade-radar-lead] error", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: err?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
