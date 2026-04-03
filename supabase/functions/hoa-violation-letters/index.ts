// HOA Violation Letters — HTTP POST from property manager dashboard
// Generates formal violation letter via Claude, stores it, emails property manager

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
      homeownerName,
      homeownerAddress,
      violationType,
      violationDescription,
      violationDate,
    } = await req.json();

    if (!clientId || !homeownerName || !violationType) {
      return new Response(
        JSON.stringify({ error: "clientId, homeownerName, and violationType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client
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
    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const violationDateStr = violationDate
      ? new Date(violationDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : todayStr;
    const cureDateStr = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const prompt = `You are a professional HOA property manager drafting a formal violation letter. Write a complete, legally appropriate violation notice.

HOA: ${hoaName}
Letter Date: ${todayStr}
Homeowner: ${homeownerName}
Homeowner Address: ${homeownerAddress || "[ADDRESS ON FILE]"}
Violation Type: ${violationType}
Violation Description: ${violationDescription || violationType}
Violation Observed Date: ${violationDateStr}
Cure Deadline: ${cureDateStr} (21 days)
HOA Contact: ${client.email || "[HOA CONTACT EMAIL]"} | ${client.phone || "[HOA CONTACT PHONE]"}

Write a formal violation letter with these sections:

1. Header: HOA name, date, homeowner name and address
2. Subject line: NOTICE OF VIOLATION — [violation type in caps]
3. Opening paragraph: Professional notice that a violation has been observed, referencing the CC&Rs (use placeholder: "[CC&Rs Section X.X]")
4. Violation Details: Clear description of the specific violation, date observed, and why it violates community standards
5. Required Action: What the homeowner must do to cure the violation by ${cureDateStr}
6. Escalation Warning: If not corrected by the cure date, consequences (fines starting at $[X] per day, possible legal action, lien on property)
7. Right to Hearing: State homeowner has the right to request a hearing before the board within 10 days
8. Contact Information: Who to contact with questions or to schedule a hearing
9. Professional closing with board signature block

Tone: Firm but respectful. Professional, not threatening. The goal is compliance, not confrontation.

Write only the letter text — no commentary before or after.`;

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
    const letterText = aiData?.content?.[0]?.text?.trim() || "";

    // Store in hoa_violation_letters
    const { data: letterRecord, error: insertErr } = await sb
      .from("hoa_violation_letters")
      .insert({
        client_id: clientId,
        homeowner_name: homeownerName,
        homeowner_address: homeownerAddress || null,
        violation_type: violationType,
        violation_description: violationDescription || null,
        violation_date: violationDate || new Date().toISOString().split("T")[0],
        letter_text: letterText,
        cure_deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[hoa-violation-letters] Insert error:", insertErr);
    }

    // Update letters_sent count
    await sb
      .from("hoa_secretary_clients")
      .update({ letters_sent: (client.letters_sent || 0) + 1 })
      .eq("id", clientId);

    // Email property manager
    if (RESEND_API_KEY && client.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² HOA Secretary <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `Violation Letter Ready — ${homeownerName} | ${violationType}`,
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² HOA Secretary</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Violation Letter — Ready to Send</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${hoaName} · ${todayStr}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#991b1b;">
        <strong>Violation:</strong> ${violationType} · <strong>Homeowner:</strong> ${homeownerName} · <strong>Cure By:</strong> ${cureDateStr}
      </p>
    </div>

    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 20px;">Your violation letter is ready. Review it below, then print and mail (or email) directly to the homeowner.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:28px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#1e293b;line-height:2;font-family:'Courier New',monospace;white-space:pre-wrap;">${letterText}</p>
    </div>

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:13px;color:#64748b;line-height:1.7;">Need edits? Reply to this email with your changes and we'll revise it.</p>
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
</body></html>`,
        }),
      });
    }

    // Notify Matt
    await notifyMatt(
      `HOA Violation Letter — ${hoaName} → ${homeownerName}`,
      `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">Violation Letter Generated</h2>
<p><strong>HOA:</strong> ${hoaName}</p>
<p><strong>Homeowner:</strong> ${homeownerName}</p>
<p><strong>Violation:</strong> ${violationType}</p>
<p><strong>Letter ID:</strong> ${letterRecord?.id || "N/A"}</p>
<p><strong>Total letters this client:</strong> ${(client.letters_sent || 0) + 1}</p>
</div>`
    );

    console.log(`[hoa-violation-letters] Letter ${letterRecord?.id} generated for ${homeownerName}`);
    return new Response(
      JSON.stringify({ success: true, letterId: letterRecord?.id, letterText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hoa-violation-letters] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
