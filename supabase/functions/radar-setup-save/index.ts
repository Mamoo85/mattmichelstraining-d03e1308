// Saves the per-client radar profile (offering, deal size, differentiators, etc.)
// Public — gated on dashboard_token match.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FIELDS = [
  "offering_summary",
  "avg_deal_size_usd",
  "close_rate_pct",
  "target_buyer_titles",
  "differentiators",
  "service_radius_miles",
  "sender_name",
  "sender_phone",
  "sender_email",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: client, error } = await sb
      .from("industry_pulse_clients")
      .select("id, dashboard_token")
      .eq("dashboard_token", token)
      .maybeSingle();
    if (error || !client) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, any> = {};
    for (const f of ALLOWED_FIELDS) {
      if (f in body && body[f] !== undefined) {
        updates[f] = body[f] === "" ? null : body[f];
      }
    }
    // Coerce numeric fields
    for (const num of ["avg_deal_size_usd", "close_rate_pct", "service_radius_miles"]) {
      if (num in updates && updates[num] != null) {
        const n = Number(updates[num]);
        updates[num] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
      }
    }
    if (!Object.keys(updates).length) {
      return new Response(JSON.stringify({ ok: true, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: updErr } = await sb
      .from("industry_pulse_clients")
      .update(updates)
      .eq("id", (client as any).id);
    if (updErr) throw updErr;

    // Invalidate fit cache so cards regenerate with new profile
    await sb.from("radar_lead_fit_cache").delete().eq("client_id", (client as any).id);

    return new Response(JSON.stringify({ ok: true, updated: Object.keys(updates).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
