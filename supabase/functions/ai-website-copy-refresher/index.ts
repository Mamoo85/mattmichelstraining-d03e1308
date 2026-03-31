// AI Website Copy Refresher — called by cron (e.g. monthly)
// 1. Reads active clients from website_copy_clients
// 2. Generates fresh homepage copy + FAQ via Claude (, )
// 3. Emails the HTML copy to the client via Resend
// 4. Notifies Matt
// 5. Updates refresh_count and last_refreshed_at

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const MATT_EMAIL = "matt@m2training.com";
const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";

interface CopyClient {
  id: string;
  email: string;
  business_name: string;
  industry: string;
  city?: string;
  website?: string;
  refresh_count: number;
}

async function generateWebsiteCopy(client: CopyClient): Promise<string> {
  const city = client.city || "Michigan";
  const website = client.website || "N/A";

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
          content: `Write fresh, compelling homepage copy and FAQ section for ${client.business_name}, a ${client.industry} business in ${city}. Website: ${website}.

Homepage copy should include:
- Hero headline (attention-grabbing, under 10 words)
- Hero subheadline (explains value, 1-2 sentences)
- 3 value propositions (each: icon emoji + title + 1-sentence description)
- Social proof section header + 3 testimonial placeholders

FAQ section should include 6 common questions and answers specific to the ${client.industry} industry.

Format as clean HTML, ready to paste into their website.` },
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

function buildClientEmail(client: CopyClient, copyHtml: string, month: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">M² Performance Training</h1>
    <p style="margin:6px 0 0;color:#e8621a;font-size:14px;">Monthly Website Copy Refresh — ${month}</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hi ${client.business_name} team,</p>
    <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
      Your fresh website copy for <strong>${month}</strong> is ready. Copy the HTML sections below and paste them into your website builder or send them to your web developer.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
      Refreshing your website copy regularly helps with SEO and keeps your messaging current.
      ${client.website && client.website !== "N/A" ? `Your current site: <a href="${client.website}" style="color:#e8621a;">${client.website}</a>` : ""}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #e8621a;border-radius:0 8px 8px 0;padding:24px;font-size:14px;color:#1e293b;line-height:1.75;">
      ${copyHtml}
    <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>

    <p style="margin:24px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
      Questions about implementing this copy? Reply to this email and I'll help.
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
      .from("website_copy_clients")
      .select("id, email, business_name, industry, city, website, refresh_count")
      .eq("active", true);

    if (error) throw error;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), {
        headers: { "Content-Type": "application/json" } });
    }

    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    let sent = 0;
    const errors: string[] = [];

    for (const client of clients as CopyClient[]) {
      try {
        const copyHtml = await generateWebsiteCopy(client);
        const emailHtml = buildClientEmail(client, copyHtml, month);

        await sendEmail(
          client.email,
          `Your Monthly Website Copy Refresh — ${month}`,
          emailHtml,
        );

        await supabase
          .from("website_copy_clients")
          .update({
            refresh_count: (client.refresh_count || 0) + 1,
            last_refreshed_at: new Date().toISOString() })
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
  <h2 style="color:#e8621a;">Website Copy Refresher — ${month} Run Complete</h2>
  <p><strong>Refreshes sent:</strong> ${sent} / ${clients.length} clients</p>
  ${errors.length > 0
    ? `<p><strong style="color:#dc2626;">Errors (${errors.length}):</strong></p><ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`
    : "<p style='color:#16a34a;'>No errors. All copy delivered successfully.</p>"}
  <p style="color:#64748b;font-size:12px;">M² Performance Training · Auto-generated report</p>
</body>
</html>`;

    await sendEmail(
      MATT_EMAIL,
      `[M²] Website Copy Refresh Complete — ${sent} clients · ${month}`,
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
