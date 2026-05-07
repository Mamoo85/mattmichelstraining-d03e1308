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
    return payload.email?.toLowerCase() === email.toLowerCase().trim() && payload.exp && payload.exp >= Date.now();
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const vertical = String(body.vertical || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const token = String(body.token || "").trim();

    if (!vertical || !token) {
      return new Response(JSON.stringify({ error: "missing_dashboard_link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    let clientQuery = sb.from("trade_radar_clients").select("id, email, business_name, zip_codes, trial_ends_at, dashboard_token").eq("vertical", vertical).eq("active", true);

    if (email) {
      const signedOk = await verifySignedToken(email, token);
      if (!signedOk) {
        return new Response(JSON.stringify({ error: "invalid_or_expired_link" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clientQuery = clientQuery.eq("email", email);
    } else {
      clientQuery = clientQuery.eq("dashboard_token", token);
    }

    const { data: client, error: clientError } = await clientQuery.maybeSingle();
    if (clientError) throw clientError;
    if (!client) {
      return new Response(JSON.stringify({ error: "not_enrolled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    let leadQuery = sb.from("trade_radar_leads")
      .select("id, full_name, address, city, zip, signal_type, signal_detail, signal_date, score, signal_count, suggested_opener, best_call_window, estimated_value, street_view_url, owner_name, owner_phone, owner_email, enriched_at, created_at")
      .eq("vertical", vertical)
      .gte("created_at", since)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (Array.isArray(client.zip_codes) && client.zip_codes.length > 0) {
      leadQuery = leadQuery.in("zip", client.zip_codes);
    }

    const { data: leads, error: leadsError } = await leadQuery;
    if (leadsError) throw leadsError;

    let actions: any[] = [];
    if (leads?.length) {
      const { data: actData, error: actError } = await sb.from("trade_radar_lead_actions")
        .select("lead_id, status, snooze_until")
        .eq("client_id", client.id)
        .in("lead_id", leads.map((lead: any) => lead.id));
      if (actError) throw actError;
      actions = actData || [];
    }

    return new Response(JSON.stringify({ ok: true, client: { ...client, dashboard_token: undefined }, leads: leads || [], actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[trade-radar-dashboard]", e);
    return new Response(JSON.stringify({ error: "dashboard_load_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});