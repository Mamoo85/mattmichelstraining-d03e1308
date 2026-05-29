// outreach-gmail-send
// Sends an email FROM the operator's connected Gmail account TO the
// enriched_email of an outreach_leads row, via the Gmail connector gateway.
// Manual-only: one click per row from the admin UI.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
// connector exposes itself with a numeric suffix
const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY_1") || Deno.env.get("GOOGLE_MAIL_API_KEY") || "";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function base64UrlEncode(input: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRfc2822(to: string, from: string | null, subject: string, body: string): string {
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ].filter(Boolean).join("\r\n");
  return `${headers}\r\n\r\n${body}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_MAIL_API_KEY) {
      return new Response(JSON.stringify({ ok: false, needs_connect: true, error: "Gmail not connected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth check — only logged-in admins
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string | undefined) || null;

    const body = await req.json().catch(() => ({}));
    const { outreach_lead_id, subject, body: messageBody } = body || {};
    if (!outreach_lead_id || !subject || !messageBody) {
      return new Response(JSON.stringify({ error: "outreach_lead_id, subject, body required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof subject !== "string" || subject.length > 500 || typeof messageBody !== "string" || messageBody.length > 50_000) {
      return new Response(JSON.stringify({ error: "subject/body invalid length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Admin role check
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load lead + enriched email
    const { data: lead, error: lErr } = await admin
      .from("outreach_leads")
      .select("id, business_name, enriched_email")
      .eq("id", outreach_lead_id)
      .single();
    if (lErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!lead.enriched_email) {
      return new Response(JSON.stringify({ error: "Lead has no enriched email — run Find Email first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve sender email from Gmail profile (best-effort)
    let fromEmail: string | null = userEmail;
    try {
      const profRes = await fetch(`${GATEWAY_URL}/users/me/profile`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        if (prof?.emailAddress) fromEmail = prof.emailAddress;
      }
    } catch { /* non-fatal */ }

    // Build + send
    const raw = base64UrlEncode(buildRfc2822(lead.enriched_email, fromEmail, subject, messageBody));
    const sendRes = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const sendData = await sendRes.json().catch(() => ({}));

    if (!sendRes.ok) {
      const errMsg = JSON.stringify(sendData);
      const needsReconnect = sendRes.status === 403 && /insufficient.*scope/i.test(errMsg);
      await admin.from("outreach_gmail_sends").insert({
        outreach_lead_id,
        sender_user_id: userId,
        sender_email: fromEmail,
        to_email: lead.enriched_email,
        subject,
        body: messageBody,
        status: "failed",
        error: `[${sendRes.status}] ${errMsg.slice(0, 500)}`,
      });
      return new Response(JSON.stringify({
        ok: false,
        needs_reconnect: needsReconnect,
        missing_scope: needsReconnect ? "https://www.googleapis.com/auth/gmail.send" : undefined,
        error: `Gmail send failed [${sendRes.status}]: ${errMsg.slice(0, 300)}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageId = sendData?.id || null;

    await admin.from("outreach_gmail_sends").insert({
      outreach_lead_id,
      sender_user_id: userId,
      sender_email: fromEmail,
      to_email: lead.enriched_email,
      subject,
      body: messageBody,
      gmail_message_id: messageId,
      status: "sent",
    });

    await admin.from("outreach_leads").update({
      gmail_sent_at: new Date().toISOString(),
      gmail_message_id: messageId,
    }).eq("id", outreach_lead_id);

    return new Response(JSON.stringify({ ok: true, gmail_message_id: messageId, from: fromEmail, to: lead.enriched_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("outreach-gmail-send error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
