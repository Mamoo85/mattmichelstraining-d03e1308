/**
 * gmail-send-outreach
 *
 * Admin-only — sends a Trojan Horse outreach email from matt@detroitwebagent.com.
 * Uses Resend API (already domain-verified) so no Gmail connector setup required.
 * Logs the send to system_comms_log and ai_action_queue.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_NAME = "Matt Michels";
const FROM_EMAIL = "matt@detroitwebagent.com";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing — add it to Supabase edge function secrets");

    // Admin gate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to, to_name, subject, html_body, plain_body, agency_name } = await req.json();

    if (!to || !subject || !html_body) {
      return new Response(JSON.stringify({ error: "to, subject, html_body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(JSON.stringify({ error: "invalid recipient email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        reply_to: FROM_EMAIL,
        subject,
        html: html_body,
        text: plain_body || undefined,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const sendData = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = sendData?.message || sendData?.error || JSON.stringify(sendData);
      console.error(`[gmail-send-outreach] Resend ${res.status}:`, errMsg);
      await sb.from("system_comms_log").insert({
        channel: "email_resend",
        direction: "outbound",
        from_addr: FROM_EMAIL,
        to_addr: to,
        subject,
        body: `Send failed [${res.status}]: ${errMsg}`,
        status: "failed",
        meta: { agency_name, http_status: res.status },
      }).then(() => {}, () => {});
      return new Response(JSON.stringify({ error: `Send failed: ${errMsg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success — log
    await sb.from("system_comms_log").insert({
      channel: "email_resend",
      direction: "outbound",
      from_addr: FROM_EMAIL,
      to_addr: to,
      subject,
      body: plain_body || "[HTML email]",
      status: "sent",
      meta: { agency_name, resend_id: sendData?.id },
    }).then(() => {}, () => {});

    await sb.from("ai_action_queue").insert({
      action_type: "trojan_horse_email_sent",
      ai_result: subject,
      context: { agency_name, to, resend_id: sendData?.id },
      status: "sent",
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({
      ok: true,
      resend_id: sendData?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[gmail-send-outreach] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
