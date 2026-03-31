// AI Weekly Digest Sender — called by cron (weekly)
// 1. Reads active clients from weekly_digest_clients
// 2. Generates a tailored weekly business digest via Claude
// 3. Sends to each client via Resend
// 4. Updates digest_count
// 5. Sends Matt a single summary email with total count

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const MATT_EMAIL = "matt@m2training.com";
const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";

interface DigestClient {
  id: string;
  email: string;
  business_name: string;
  contact_name: string;
  industry: string;
  digest_count: number;
}

async function generateDigest(client: DigestClient): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [
        {
          role: "user",
          content: `Write a short, valuable weekly business digest email for the ${client.industry} industry. Include: 1 quick tip to get more customers, 1 operational efficiency tip, 1 marketing insight. Keep it under 200 words total, punchy and actionable. Format as simple HTML paragraphs.` },
      ] }) });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error: ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

function buildDigestEmail(client: DigestClient, digestHtml: string, dateStr: string): string {
  const greeting = client.contact_name ? `Hi ${client.contact_name},` : `Hi there,`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">M² Performance Training</h1>
    <p style="margin:6px 0 0;color:#e8621a;font-size:14px;">Your Weekly Business Digest — ${dateStr}</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 20px;font-size:16px;color:#1e293b;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Here's your weekly digest packed with actionable insights for the <strong>${client.industry}</strong> industry.
    </p>

    <div style="font-size:15px;color:#1e293b;line-height:1.75;">
      ${digestHtml}
    </div>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">

    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
      Have a question or want to talk strategy? Reply to this email — I read every one.
    </p>
  </td></tr>

  <tr><td style="background:#f1f5f9;padding:16px 28px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <img src="https://mattmichelstraining.com/images/matt-boat.jpg"
            alt="Matt Michels" width="48" height="48"
            style="border-radius:50%;vertical-align:middle;margin-right:12px;">
          <span style="font-size:13px;color:#475569;vertical-align:middle;">
            Matt Michels · matt@m2training.com · (313) 806-4952
          </span>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await supabase
      .from("weekly_digest_clients")
      .select("id, email, business_name, contact_name, industry, digest_count")
      .eq("active", true);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), {
        headers: { "Content-Type": "application/json" } });
    }

    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric" });

    let sent = 0;
    const errors: string[] = [];

    for (const client of clients as DigestClient[]) {
      try {
        const digestHtml = await generateDigest(client);
        const emailHtml = buildDigestEmail(client, digestHtml, dateStr);

        await sendEmail(
          client.email,
          "Your Weekly Business Digest",
          emailHtml,
        );

        await supabase
          .from("weekly_digest_clients")
          .update({ digest_count: (client.digest_count || 0) + 1 })
          .eq("id", client.id);

        sent++;
      } catch (err) {
        const msg = `Failed for ${client.email}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Single summary email to Matt
    const mattHtml = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:24px;color:#1e293b;">
  <h2 style="color:#e8621a;">Weekly Digest — ${dateStr}</h2>
  <p><strong>Digests sent:</strong> ${sent} / ${clients.length} clients</p>
  ${errors.length > 0
    ? `<p><strong style="color:#dc2626;">Errors (${errors.length}):</strong></p><ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`
    : "<p style='color:#16a34a;'>No errors. All digests delivered.</p>"}
  <p style="color:#64748b;font-size:12px;">M² Performance Training · Auto-generated report</p>
</body>
</html>`;

    await sendEmail(
      MATT_EMAIL,
      `[M²] Weekly Digest Summary — ${sent} digests sent`,
      mattHtml,
    );

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" } });
  }
});
