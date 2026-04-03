// HOA Secretary — HTTP POST from board member dashboard
// Transforms raw meeting notes into professional HOA minutes, emails board

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
    const { clientId, meetingDate, rawNotes, attendees } = await req.json();

    if (!clientId || !rawNotes) {
      return new Response(JSON.stringify({ error: "clientId and rawNotes are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client record
    const { data: client, error: clientErr } = await sb
      .from("hoa_secretary_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoaName = client.hoa_name || client.business_name || "Homeowners Association";
    const formattedDate = meetingDate
      ? new Date(meetingDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const attendeeList = attendees || client.default_attendees || "Board members present";

    const prompt = `You are a professional HOA secretary. Transform the following raw meeting notes into formal, properly structured HOA meeting minutes.

HOA Name: ${hoaName}
Meeting Date: ${formattedDate}
Attendees: ${attendeeList}

Raw Notes:
${rawNotes}

Generate professional HOA meeting minutes in this exact format:

---MINUTES---

${hoaName.toUpperCase()}
BOARD OF DIRECTORS MEETING MINUTES
${formattedDate}

CALL TO ORDER
[State who called meeting to order, time, and quorum confirmation]

ATTENDEES
Present: ${attendeeList}
[Note any absent members or guests]

APPROVAL OF PREVIOUS MINUTES
[State motion, second, and vote to approve previous meeting's minutes]

OLD BUSINESS
[List each item from raw notes that is ongoing from prior meetings. Use sub-bullets for discussion points and any votes taken. Format: Item name → Discussion → Action/Vote]

NEW BUSINESS
[List each new item discussed. Use sub-bullets for discussion and votes. If a vote was taken, record: Motion by [name], Seconded by [name], Vote: X-Y-Z]

ACTION ITEMS
[Create a clear table in this format:]
| Action Item | Responsible Party | Due Date |
|-------------|------------------|----------|
[List all commitments made during the meeting]

NEXT MEETING
[State next meeting date, time, and location if mentioned, otherwise write "To be announced"]

ADJOURNMENT
Meeting adjourned at [time if mentioned, otherwise "upon completion of agenda"] by [name if mentioned].

Respectfully submitted,
[Board Secretary Name — use "Board Secretary" if not specified]

---END---

Be thorough, professional, and accurate to the raw notes. If information is missing (like specific times or names), use reasonable professional defaults.`;

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

    // Extract minutes content
    const minutesStart = fullText.indexOf("---MINUTES---");
    const minutesEnd = fullText.indexOf("---END---");
    const minutesText =
      minutesStart !== -1
        ? fullText.slice(minutesStart + "---MINUTES---".length, minutesEnd !== -1 ? minutesEnd : undefined).trim()
        : fullText.trim();

    // Store in hoa_meeting_minutes
    const { data: minutesRecord, error: insertErr } = await sb
      .from("hoa_meeting_minutes")
      .insert({
        client_id: clientId,
        meeting_date: meetingDate || new Date().toISOString().split("T")[0],
        raw_notes: rawNotes,
        attendees: attendeeList,
        formatted_minutes: minutesText,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[hoa-secretary] Minutes insert error:", insertErr);
    }

    // Update minutes_generated count
    await sb
      .from("hoa_secretary_clients")
      .update({ minutes_generated: (client.minutes_generated || 0) + 1 })
      .eq("id", clientId);

    // Format minutes as HTML for email
    const minutesHtml = minutesText
      .replace(/\n\n/g, "</p><p style='margin:0 0 12px;'>")
      .replace(/\n/g, "<br>")
      .replace(/\|(.+?)\|/g, (match) => {
        if (match.includes("---")) return match; // skip separator rows
        const cells = match.split("|").filter((c) => c.trim());
        return "<tr>" + cells.map((c) => `<td style="padding:8px 12px;border:1px solid #e2e8f0;">${c.trim()}</td>`).join("") + "</tr>";
      });

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² HOA Secretary</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Meeting Minutes Ready</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${hoaName} · ${formattedDate}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">Your meeting minutes have been generated and are ready for distribution. Review, print, or share as needed.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:28px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:2;font-family:'Courier New',monospace;white-space:pre-wrap;">${minutesText}</p>
    </div>

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Need corrections or edits? Reply to this email with your changes.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² HOA Secretary · (313) 806-4952</div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    // Build recipient list: submitting board member + all member emails on client record
    const recipients: string[] = [];
    if (client.email) recipients.push(client.email);
    if (client.member_emails && Array.isArray(client.member_emails)) {
      recipients.push(...client.member_emails);
    }
    const uniqueRecipients = [...new Set(recipients)];

    // Send to board
    if (RESEND_API_KEY && uniqueRecipients.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² HOA Secretary <matt@mattmichelstraining.com>",
          to: uniqueRecipients,
          subject: `Meeting Minutes — ${hoaName} · ${formattedDate}`,
          html: emailHtml,
        }),
      });
    }

    // Notify Matt
    await notifyMatt(
      `HOA Minutes Generated — ${hoaName}`,
      `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">HOA Minutes Generated</h2>
<p><strong>HOA:</strong> ${hoaName}</p>
<p><strong>Meeting Date:</strong> ${formattedDate}</p>
<p><strong>Minutes ID:</strong> ${minutesRecord?.id || "N/A"}</p>
<p><strong>Sent to:</strong> ${uniqueRecipients.join(", ")}</p>
<p><strong>Total minutes this client:</strong> ${(client.minutes_generated || 0) + 1}</p>
</div>`
    );

    console.log(`[hoa-secretary] Minutes generated for ${hoaName}, ID: ${minutesRecord?.id}`);
    return new Response(
      JSON.stringify({ success: true, minutesId: minutesRecord?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hoa-secretary] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
