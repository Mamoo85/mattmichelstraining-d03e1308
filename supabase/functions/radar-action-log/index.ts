// Logs a radar lead action (called/emailed/linkedin/sms/crm/won/lost/snooze).
// Public — token-gated at the dashboard URL level.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED = new Set([
  "called", "emailed", "linkedin", "sms", "crm",
  "copied_opener", "won", "lost", "snooze", "viewed",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });
  }
  try {
    const { signal_id, client_id, radar, action, notes } = await req.json();
    if (!signal_id || !client_id || !radar || !action || !ALLOWED.has(action)) {
      return new Response(JSON.stringify({ error: "bad input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { error } = await sb.from("radar_lead_actions").insert({
      signal_id: String(signal_id),
      client_id: String(client_id),
      radar: String(radar),
      action: String(action),
      notes: notes ? String(notes).slice(0, 1000) : null,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
