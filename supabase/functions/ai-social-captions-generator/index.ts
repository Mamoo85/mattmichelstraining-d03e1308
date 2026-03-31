// AI Social Captions Generator — called by cron (e.g. monthly)
// 1. Reads active clients from social_captions_clients
// 2. Generates 30 varied social media captions via Claude
// 3. Emails captions to the client via Resend
// 4. Notifies Matt
// 5. Updates pack_count and last_sent_at

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";


const MATT_EMAIL = "matt@m2training.com";
const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";

interface CaptionsClient {
  id: string;
  email: string;
  business_name: string;
  industry: string;
  platforms: string;
  pack_count: number;
}


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

async function generateCaptions(client: CaptionsClient): Promise<string> {
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
          content: `Generate 30 social media captions for ${client.business_name}, a ${client.industry} business. Platforms: ${client.platforms}. Make them varied: promotional (10), educational/tips (10), engaging/question-based (10). Each caption should be ready to post, include 3-5 relevant hashtags, and be under 280 characters. Number each caption 1-30. Format as a plain numbered list.` },
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
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, bcc: ["matthewmichels4@gmail.com"] }) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

function buildClientEmail(client: CaptionsClient, captions: string, month: string): string {
  const captionsHtml = captions
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 12px 0;">${line.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">M² Performance Training</h1>
    <p style="margin:6px 0 0;color:#e8621a;font-size:14px;">Social Media Captions — ${month}</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hi ${client.business_name} team,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
      Here are your <strong>30 ready-to-post social media captions</strong> for ${month}.
      Copy and schedule them across ${client.platforms}. Mix them up — aim for 2–3 posts per week for best results.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:24px;font-size:14px;color:#1e293b;line-height:1.8;">
      ${captionsHtml}
    </div>

    <p style="margin:24px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
      <strong>Pro tip:</strong> Schedule your promotional posts for Tuesday–Thursday,
      educational tips on Monday mornings, and engagement questions on Friday afternoons.
    </p>
  </td></tr>

  <tr><td style="background:#f1f5f9;padding:16px 28px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      M² Performance Training · matt@m2training.com · (313) 806-4952
    </p>
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
      .from("social_captions_clients")
      .select("id, email, business_name, industry, platforms, pack_count")
      .eq("active", true);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), {
        headers: { "Content-Type": "application/json" } });
    }

    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    let sent = 0;
    const errors: string[] = [];

    for (const client of clients as CaptionsClient[]) {
      try {
        const captions = await generateCaptions(client);

        const clientHtml = buildClientEmail(client, captions, month);
        await sendEmail(
          client.email,
          `Your 30 Social Media Captions for ${month}`,
          clientHtml,
        );

        await supabase
          .from("social_captions_clients")
          .update({
            pack_count: (client.pack_count || 0) + 1,
            last_sent_at: new Date().toISOString() })
          .eq("id", client.id);

        sent++;
      } catch (err) {
        const msg = `Failed for ${client.email}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Notify Matt
    const mattHtml = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:24px;color:#1e293b;">
  <h2 style="color:#e8621a;">Social Captions Generator — ${month} Run Complete</h2>
  <p><strong>Captions sent:</strong> ${sent} / ${clients.length} clients</p>
  ${errors.length > 0 ? `<p><strong>Errors:</strong></p><ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>` : "<p>No errors. All good!</p>"}
  <p style="color:#64748b;font-size:12px;">M² Performance Training · Auto-generated report</p>
</body>
</html>`;

    await sendEmail(
      MATT_EMAIL,
      `[M²] Social Captions Sent — ${sent} clients · ${month}`,
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
