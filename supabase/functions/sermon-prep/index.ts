// Sermon Prep Weekly — cron every Monday 6am ET (0 11 * * 1)
// Generates full sermon prep package for each active pastor via Claude, emails it

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

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

function getSundayDate(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  return nextSunday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients, error } = await sb
    .from("sermon_prep_clients")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("[sermon-prep] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!clients?.length) {
    console.log("[sermon-prep] No active clients");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  const sundayDate = getSundayDate();
  let processed = 0;
  let failed = 0;

  for (const client of clients) {
    try {
      const denomination = client.denomination || "non-denominational Christian";
      const pastorName = client.pastor_name || client.contact_name || "Pastor";
      const churchName = client.church_name || client.business_name || "your church";

      const prompt = `You are an expert sermon preparation assistant. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. The upcoming Sunday is ${sundayDate}.

The pastor is ${pastorName} at ${churchName}, denomination: ${denomination}.

First, identify the most appropriate Revised Common Lectionary readings for the Sunday of ${sundayDate}. If you are uncertain of the exact RCL reading for that date, choose the most seasonally and liturgically appropriate Scripture passages for that time of year.

Then generate a complete sermon preparation package with these exact sections:

---LECTIONARY---
State the suggested Scripture passages for this Sunday (Old Testament, Psalm, Epistle, Gospel). Include the season/week of the church year.

---OUTLINE---
A 3-point sermon outline based on the Gospel reading. Include:
- Sermon title (compelling and accessible)
- Main thesis/big idea (one sentence)
- Point 1: [title] — brief description
- Point 2: [title] — brief description
- Point 3: [title] — brief description
- Closing call to action

---ILLUSTRATIONS---
2-3 sermon illustrations (stories, analogies, or contemporary examples) that connect to this week's theme. Each should be 3-5 sentences, vivid, and usable from the pulpit.

---COMMENTARY---
Scripture commentary on the primary Gospel passage: key Greek/Hebrew words worth noting, historical context, theological significance, and 2-3 interpretive insights that could spark sermon ideas.

---SMALL GROUP---
5 application/discussion questions for small groups based on this week's passage. Questions should move from observation to interpretation to personal application.

---CHILDRENS MESSAGE---
A 150-word children's message for ages 5-10 that captures the main theme in simple, concrete terms. Include a simple object lesson or activity if appropriate.

Write for a ${denomination} context. Be theologically sound, practically helpful, and inspiring.`;

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

      // Parse sections
      const extractSection = (text: string, marker: string, nextMarker?: string): string => {
        const start = text.indexOf(`---${marker}---`);
        if (start === -1) return "";
        const contentStart = start + `---${marker}---`.length;
        const end = nextMarker ? text.indexOf(`---${nextMarker}---`) : text.length;
        return text.slice(contentStart, end === -1 ? text.length : end).trim();
      };

      const lectionarySection = extractSection(fullText, "LECTIONARY", "OUTLINE");
      const outlineSection = extractSection(fullText, "OUTLINE", "ILLUSTRATIONS");
      const illustrationsSection = extractSection(fullText, "ILLUSTRATIONS", "COMMENTARY");
      const commentarySection = extractSection(fullText, "COMMENTARY", "SMALL GROUP");
      const smallGroupSection = extractSection(fullText, "SMALL GROUP", "CHILDRENS MESSAGE");
      const childrensSection = extractSection(fullText, "CHILDRENS MESSAGE");

      const formatSection = (content: string) =>
        content.replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

      // Email pastor
      if (RESEND_API_KEY && client.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Sermon Prep <matt@mattmichelstraining.com>",
            to: [client.email],
            subject: `Your Sermon Prep Package — ${sundayDate}`,
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² Sermon Prep</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Sunday, ${sundayDate}</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Good morning, ${pastorName}. Here's your weekly prep package.</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    ${lectionarySection ? `
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;margin:0 0 24px;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;color:#1d4ed8;text-transform:uppercase;">This Week's Lectionary Readings</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.8;">${formatSection(lectionarySection)}</p>
    </div>` : ""}

    ${outlineSection ? `
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">3-Point Sermon Outline</p>
      <div style="background:#f1f5f9;border-left:4px solid #e8621a;padding:16px 20px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${formatSection(outlineSection)}</p>
      </div>
    </div>` : ""}

    ${illustrationsSection ? `
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#7c3aed;text-transform:uppercase;">Sermon Illustrations</p>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;padding:16px 20px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${formatSection(illustrationsSection)}</p>
      </div>
    </div>` : ""}

    ${commentarySection ? `
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#065f46;text-transform:uppercase;">Scripture Commentary</p>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:16px 20px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${formatSection(commentarySection)}</p>
      </div>
    </div>` : ""}

    ${smallGroupSection ? `
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#92400e;text-transform:uppercase;">Small Group Discussion Questions</p>
      <div style="background:#fffbeb;border:1px solid #fcd34d;padding:16px 20px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${formatSection(smallGroupSection)}</p>
      </div>
    </div>` : ""}

    ${childrensSection ? `
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#be185d;text-transform:uppercase;">Children's Message (Ages 5-10)</p>
      <div style="background:#fdf2f8;border:1px solid #f9a8d4;padding:16px 20px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.9;">${formatSection(childrensSection)}</p>
      </div>
    </div>` : ""}

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Questions or want a different passage focus? Reply to this email anytime.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Sermon Prep · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
          }),
        });
      }

      // Update stats
      await sb
        .from("sermon_prep_clients")
        .update({
          sermons_delivered: (client.sermons_delivered || 0) + 1,
          last_delivery_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      processed++;
      console.log(`[sermon-prep] Delivered to ${pastorName} at ${churchName}`);
    } catch (e) {
      console.error(`[sermon-prep] Error for client ${client.id}:`, e);
      failed++;
    }
  }

  // Notify Matt with summary
  await notifyMatt(
    `Sermon Prep Sent — ${sundayDate} (${processed} pastors)`,
    `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">Sermon Prep Weekly Run</h2>
<p><strong>Sunday:</strong> ${sundayDate}</p>
<p><strong>Delivered:</strong> ${processed}</p>
<p><strong>Failed:</strong> ${failed}</p>
</div>`
  );

  console.log(`[sermon-prep] Done — ${processed} delivered, ${failed} failed`);
  return new Response(JSON.stringify({ processed, failed, sunday: sundayDate }), { status: 200 });
});
