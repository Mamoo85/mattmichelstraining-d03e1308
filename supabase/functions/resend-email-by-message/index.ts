// resend-email-by-message
// Manually re-queue a previously-logged email by message_id.
// Only works for templates registered in the transactional registry
// (welcome, order-confirmation, subscription-activated, check-in-confirmation).
// Cold-outreach templates are not re-sendable here because their bodies are not stored.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESENDABLE_TEMPLATES = new Set([
  "welcome",
  "order-confirmation",
  "subscription-activated",
  "check-in-confirmation",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { message_id, recipient_email } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    const { data: row, error } = await sb
      .from("email_send_log")
      .select("template_name, recipient_email, metadata")
      .eq("message_id", message_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ error: "log row not found", details: error?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = recipient_email || row.recipient_email;
    if (!to) {
      return new Response(JSON.stringify({ error: "no recipient" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESENDABLE_TEMPLATES.has(row.template_name)) {
      return new Response(JSON.stringify({
        error: "template not resendable",
        details: `'${row.template_name}' is not a registered transactional template. Cold/drip emails generate fresh bodies per send.`,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error: invokeErr } = await sb.functions.invoke("send-transactional-email", {
      body: {
        templateName: row.template_name,
        to,
        data: row.metadata || {},
        idempotencyKey: `resend-${message_id}-${Date.now()}`,
      },
    });

    if (invokeErr) {
      return new Response(JSON.stringify({ error: "resend failed", details: invokeErr.message }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, to, template: row.template_name, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
