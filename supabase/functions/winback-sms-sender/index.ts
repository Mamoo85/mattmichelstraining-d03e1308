// Winback SMS Sender — called by cron
// 1. Reads active clients from winback_sms_clients
// 2. Loads opted-in contacts from winback_sms_contacts
// 3. Generates personalized win-back SMS via Claude
// 4. Sends SMS via Twilio to each contact
// 5. Updates campaign_count
// 6. Emails Matt a summary report

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

const MATT_EMAIL = "matt@m2training.com";
const FROM_EMAIL = "Matt Michels <matt@notify.m2training.com>";

interface WinbackClient {
  id: string;
  email: string;
  business_name: string;
  industry: string;
  twilio_number: string;
  campaign_count: number;
}

interface WinbackContact {
  id: string;
  client_email: string;
  phone: string;
  name?: string;
  opted_in: boolean;
}

async function generateWinbackMessage(client: WinbackClient): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Write a short, friendly win-back SMS for ${client.business_name} (${client.industry}). The message should make the customer feel missed and offer a reason to come back. Under 160 characters. End with 'Reply STOP to opt out.'`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || "").trim();
  // Enforce 160-char limit as a safety net
  return text.length <= 160 ? text : text.slice(0, 157) + "...";
}

async function sendSms(
  to: string,
  from: string,
  body: string,
): Promise<void> {
  const encoded = new URLSearchParams({ To: to, From: from, Body: body });
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encoded.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error: ${err}`);
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error: clientsError } = await supabase
      .from("winback_sms_clients")
      .select("id, email, business_name, industry, twilio_number, campaign_count")
      .eq("active", true);

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    const reportRows: string[] = [];
    const globalErrors: string[] = [];

    for (const client of clients as WinbackClient[]) {
      try {
        // Fetch opted-in contacts for this client
        const { data: contacts, error: contactsError } = await supabase
          .from("winback_sms_contacts")
          .select("id, client_email, phone, name, opted_in")
          .eq("client_email", client.email)
          .eq("opted_in", true);

        if (contactsError) throw contactsError;
        if (!contacts || contacts.length === 0) {
          reportRows.push(`${client.business_name}: 0 contacts (skipped)`);
          continue;
        }

        // Generate one message per client (same copy, broadcast to all contacts)
        const message = await generateWinbackMessage(client);

        let clientSent = 0;
        const clientErrors: string[] = [];

        for (const contact of contacts as WinbackContact[]) {
          try {
            await sendSms(contact.phone, client.twilio_number, message);
            clientSent++;
            totalSent++;
          } catch (smsErr) {
            const msg = `  SMS failed to ${contact.phone}: ${(smsErr as Error).message}`;
            clientErrors.push(msg);
          }
        }

        // Update campaign_count
        await supabase
          .from("winback_sms_clients")
          .update({ campaign_count: (client.campaign_count || 0) + 1 })
          .eq("id", client.id);

        const summary = `${client.business_name}: ${clientSent}/${contacts.length} sent`;
        reportRows.push(
          clientErrors.length > 0
            ? `${summary} (${clientErrors.length} errors: ${clientErrors.join(", ")})`
            : summary,
        );
      } catch (clientErr) {
        const msg = `${client.business_name}: ERROR — ${(clientErr as Error).message}`;
        console.error(msg);
        globalErrors.push(msg);
        reportRows.push(msg);
      }
    }

    // Email Matt a summary
    const now = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const mattHtml = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:24px;color:#1e293b;">
  <h2 style="color:#e8621a;">Winback SMS Campaign — ${now}</h2>
  <p><strong>Total SMS sent:</strong> ${totalSent}</p>
  <p><strong>Clients processed:</strong> ${clients.length}</p>
  <h3 style="margin-top:20px;">Per-Client Summary</h3>
  <ul>${reportRows.map((r) => `<li>${r}</li>`).join("")}</ul>
  ${globalErrors.length > 0 ? `<p style="color:#dc2626;"><strong>Fatal errors:</strong></p><ul>${globalErrors.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}
  <p style="color:#64748b;font-size:12px;">M² Performance Training · Auto-generated report</p>
</body>
</html>`;

    await sendEmail(
      MATT_EMAIL,
      `[M²] Winback SMS Report — ${totalSent} messages sent`,
      mattHtml,
    );

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
