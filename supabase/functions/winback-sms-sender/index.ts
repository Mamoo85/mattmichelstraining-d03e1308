import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";


const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const MATT_EMAIL = "matt@mattmichelstraining.com";
const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

async function generateWinbackMessage(client: any): Promise<string> {
  if (!LOVABLE_API_KEY) return `We miss you at ${client.business_name}! Come back and see what's new. Reply STOP to opt out.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: `Write a short, friendly win-back SMS for ${client.business_name} (${client.industry}). Make the customer feel missed and offer a reason to come back. Under 160 characters. End with 'Reply STOP to opt out.'` }],
    }),
  });
  if (!res.ok) throw new Error(`AI error: ${await res.text()}`);
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content || "").trim();
  return text.length <= 160 ? text : text.slice(0, 157) + "...";
}

async function sendSms(to: string, from: string, body: string): Promise<void> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio gateway error: ${await res.text()}`);
}

async function sendEmail(to: string, subject: string,
        bcc: ["matthewmichels@gmail.com"], html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: clients, error: clientsError } = await supabase.from("winback_sms_clients").select("id, email, business_name, industry, twilio_number, campaign_count").eq("active", true);
    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), { headers: { "Content-Type": "application/json" } });

    let totalSent = 0;
    const reportRows: string[] = [];
    const globalErrors: string[] = [];

    for (const client of clients) {
      try {
        const { data: contacts, error: contactsError } = await supabase.from("winback_sms_contacts").select("id, client_email, phone, name, opted_in").eq("client_email", client.email).eq("opted_in", true);
        if (contactsError) throw contactsError;
        if (!contacts || contacts.length === 0) { reportRows.push(`${client.business_name}: 0 contacts (skipped)`); continue; }

        const message = await generateWinbackMessage(client);
        let clientSent = 0;
        const clientErrors: string[] = [];

        for (const contact of contacts) {
          try { await sendSms(contact.phone, client.twilio_number, message); clientSent++; totalSent++; }
          catch (smsErr) { clientErrors.push(`SMS failed to ${contact.phone}: ${(smsErr as Error).message}`); }
        }

        await supabase.from("winback_sms_clients").update({ campaign_count: (client.campaign_count || 0) + 1 }).eq("id", client.id);
        const summary = `${client.business_name}: ${clientSent}/${contacts.length} sent`;
        reportRows.push(clientErrors.length > 0 ? `${summary} (${clientErrors.length} errors: ${clientErrors.join(", ")})` : summary);
      } catch (clientErr) {
        const msg = `${client.business_name}: ERROR — ${(clientErr as Error).message}`;
        console.error(msg); globalErrors.push(msg); reportRows.push(msg);
      }
    }

    const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const mattHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;color:#1e293b;"><h2 style="color:#e8621a;">Winback SMS Campaign — ${now}</h2><p><strong>Total SMS sent:</strong> ${totalSent}</p><p><strong>Clients processed:</strong> ${clients.length}</p><h3 style="margin-top:20px;">Per-Client Summary</h3><ul>${reportRows.map((r) => `<li>${r}</li>`).join("")}</ul>${globalErrors.length > 0 ? `<p style="color:#dc2626;"><strong>Fatal errors:</strong></p><ul>${globalErrors.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}<p style="color:#64748b;font-size:12px;">M2 Development · Auto-generated report</p></body></html>`;
    await sendEmail(MATT_EMAIL, `[M²] Winback SMS Report — ${totalSent} messages sent`, mattHtml);

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
