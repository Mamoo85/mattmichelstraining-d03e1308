// Obituary Service — HTTP POST from funeral home dashboard
// Receives intake data, generates compassionate obituary via Claude, emails funeral home + notifies Matt

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      subject,
      html,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const {
      clientId,
      deceasedName,
      birthDate,
      deathDate,
      survivors,
      career,
      hobbies,
      faith,
      education,
      specialNotes,
    } = await req.json();

    if (!clientId || !deceasedName) {
      return new Response(JSON.stringify({ error: "clientId and deceasedName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client record for funeral home email
    const { data: client, error: clientErr } = await sb
      .from("obituary_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert order with status processing
    const { data: order, error: orderErr } = await sb
      .from("obituary_orders")
      .insert({
        client_id: clientId,
        deceased_name: deceasedName,
        birth_date: birthDate || null,
        death_date: deathDate || null,
        survivors: survivors || null,
        career: career || null,
        hobbies: hobbies || null,
        faith: faith || null,
        education: education || null,
        special_notes: specialNotes || null,
        status: "processing",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("[obituary-service] Order insert error:", orderErr);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Claude prompt
    const birthYear = birthDate ? new Date(birthDate).getFullYear() : null;
    const deathYear = deathDate ? new Date(deathDate).getFullYear() : null;
    const ageStr = birthYear && deathYear ? ` (${deathYear - birthYear})` : "";
    const dateStr = deathDate
      ? new Date(deathDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "recently";

    const prompt = `You are writing an obituary for a funeral home. The obituary must be compassionate, dignified, and deeply personal. Write in third person. Target length: 450-550 words for the main obituary.

Deceased: ${deceasedName}${ageStr}
Date of passing: ${dateStr}
${birthDate ? `Born: ${new Date(birthDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
${survivors ? `Surviving family: ${survivors}` : ""}
${career ? `Career/work life: ${career}` : ""}
${hobbies ? `Hobbies and interests: ${hobbies}` : ""}
${faith ? `Faith/religion: ${faith}` : ""}
${education ? `Education: ${education}` : ""}
${specialNotes ? `Special notes: ${specialNotes}` : ""}

Write THREE versions:

---NEWSPAPER---
A formal, traditional obituary (450-550 words) suitable for newspaper publication. Include: full name, date and place of death if known, life overview, survivors, career highlights, personality/passions, memorial service placeholder "[Service details to be announced]". End with a meaningful closing line.

---SOCIAL MEDIA---
A warm, shareable social media post (150-200 words) celebrating their life. Lead with a heartfelt opening line. Include 2-3 of their most memorable qualities. End with "Rest in peace" and their name. Use no hashtags.

---WEBSITE---
A slightly longer, more personal version (300-400 words) for the funeral home website. More conversational tone. Can include more personal anecdotes and details. Should feel like a tribute written by someone who knew them.

Separate each section with the exact dividers shown above. Write with genuine compassion and avoid clichés.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const fullText = aiData?.content?.[0]?.text || "";

    // Parse the three versions
    const extractSection = (text: string, marker: string, nextMarker?: string): string => {
      const start = text.indexOf(`---${marker}---`);
      if (start === -1) return "";
      const contentStart = start + `---${marker}---`.length;
      const end = nextMarker ? text.indexOf(`---${nextMarker}---`) : text.length;
      return text.slice(contentStart, end === -1 ? text.length : end).trim();
    };

    const newspaperVersion = extractSection(fullText, "NEWSPAPER", "SOCIAL MEDIA");
    const socialVersion = extractSection(fullText, "SOCIAL MEDIA", "WEBSITE");
    const websiteVersion = extractSection(fullText, "WEBSITE");

    // Update order with generated text
    await sb
      .from("obituary_orders")
      .update({
        obituary_text: fullText,
        newspaper_version: newspaperVersion,
        social_media_version: socialVersion,
        website_version: websiteVersion,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    // Increment obituaries_written on client
    await sb
      .from("obituary_clients")
      .update({ obituaries_written: (client.obituaries_written || 0) + 1 })
      .eq("id", clientId);

    // Email funeral home
    if (RESEND_API_KEY && client.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Writing Services <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `Obituary Ready — ${deceasedName}`,
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² Writing Services</p>
    <p style="margin:4px 0 0;color:#fff;font-size:18px;font-weight:700;">Obituary — ${deceasedName}</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">Your obituary for <strong>${deceasedName}</strong> is ready. We've prepared three versions for your use below.</p>

    <div style="background:#f1f5f9;border-left:4px solid #e8621a;padding:20px 24px;margin:0 0 28px;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">Newspaper Version</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;white-space:pre-line;">${newspaperVersion || fullText}</p>
    </div>

    ${socialVersion ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px 24px;margin:0 0 28px;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#166534;text-transform:uppercase;">Social Media Caption</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;white-space:pre-line;">${socialVersion}</p>
    </div>` : ""}

    ${websiteVersion ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;padding:20px 24px;margin:0 0 28px;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#9a3412;text-transform:uppercase;">Website Tribute</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;white-space:pre-line;">${websiteVersion}</p>
    </div>` : ""}

    <p style="font-size:13px;color:#64748b;line-height:1.7;margin:24px 0 0;">Questions or revisions? Reply to this email or call Matt at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Writing Services · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
        }),
      });
    }

    // Notify Matt
    await notifyMatt(
      `New Obituary Order — ${deceasedName} (${client.business_name || client.email})`,
      `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;margin:0 0 12px;">New Obituary Order</h2>
<p><strong>Client:</strong> ${client.business_name || client.email}</p>
<p><strong>Deceased:</strong> ${deceasedName}</p>
<p><strong>Order ID:</strong> ${order.id}</p>
<p><strong>Status:</strong> Complete — emailed to funeral home</p>
<p><strong>Total written this client:</strong> ${(client.obituaries_written || 0) + 1}</p>
</div>`
    );

    console.log(`[obituary-service] Completed order ${order.id} for ${deceasedName}`);
    return new Response(
      JSON.stringify({ success: true, obituaryId: order.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[obituary-service] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
