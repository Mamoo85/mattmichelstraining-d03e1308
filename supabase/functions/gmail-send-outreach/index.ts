/**
 * gmail-send-outreach
 *
 * Admin-only — sends a Trojan Horse outreach email through Matt's Gmail
 * (matt@detroitwebagent.com) via the Lovable connector gateway. Builds a
 * proper RFC 2822 multipart/alternative MIME message (HTML + plain) so it
 * renders beautifully in any client, then logs the send to system_comms_log.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GMAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY") || "";
const FROM_NAME = "Matt Michels";
const FROM_EMAIL = "matt@detroitwebagent.com";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function base64UrlEncode(str: string): string {
  // Encode to base64 then make URL-safe
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMimeMessage(opts: {
  to: string;
  toName?: string | null;
  from: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  plain: string;
}): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const toHeader = opts.toName ? `"${opts.toName.replace(/"/g, "")}" <${opts.to}>` : opts.to;
  const fromHeader = `"${opts.fromName.replace(/"/g, "")}" <${opts.from}>`;

  // Subject — RFC 2047 encode if non-ASCII
  const needsEncoding = /[^\x20-\x7e]/.test(opts.subject);
  const subjectHeader = needsEncoding
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`
    : opts.subject;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : `Reply-To: ${opts.from}`,
    `Subject: ${subjectHeader}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");

  const body = [
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.plain,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");

  return `${headers}\r\n${body}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GMAIL_API_KEY) throw new Error("Gmail connection not linked — connect Google Mail in Connectors");

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

    const mime = buildMimeMessage({
      to,
      toName: to_name,
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      subject,
      html: html_body,
      plain: plain_body || "(plain-text version unavailable — please view in HTML mode)",
    });

    const raw = base64UrlEncode(mime);

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(20_000),
    });

    const sendData = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = sendData?.error?.message || JSON.stringify(sendData);
      console.error(`[gmail-send-outreach] Gmail API ${res.status}:`, errMsg);
      // Log failure
      await sb.from("system_comms_log").insert({
        channel: "email_gmail",
        direction: "outbound",
        from_addr: FROM_EMAIL,
        to_addr: to,
        subject,
        body: `Gmail send failed [${res.status}]: ${errMsg}`,
        status: "failed",
        meta: { agency_name, http_status: res.status },
      }).then(() => {}, () => {});
      return new Response(JSON.stringify({ error: `Gmail send failed: ${errMsg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success — log
    await sb.from("system_comms_log").insert({
      channel: "email_gmail",
      direction: "outbound",
      from_addr: FROM_EMAIL,
      to_addr: to,
      subject,
      body: plain_body || "[HTML email — see Gmail Sent folder]",
      status: "sent",
      meta: {
        agency_name,
        gmail_message_id: sendData?.id,
        gmail_thread_id: sendData?.threadId,
      },
    }).then(() => {}, () => {});

    // Audit
    await sb.from("ai_action_queue").insert({
      action_type: "trojan_horse_email_sent",
      ai_result: subject,
      context: { agency_name, to, gmail_message_id: sendData?.id },
      status: "sent",
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({
      ok: true,
      gmail_message_id: sendData?.id,
      gmail_thread_id: sendData?.threadId,
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
