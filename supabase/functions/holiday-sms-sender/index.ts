import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MATT_EMAIL = "matt@mattmichelstraining.com";
const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface HolidayClient {
  id: string; email: string; business_name: string; industry: string;
  twilio_number: string; blast_count: number;
}

interface HolidayContact {
  id: string; client_email: string; phone: string; name?: string; opted_in: boolean;
}


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

async function generateHolidayMessage(client: HolidayClient, holiday: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return `Happy ${holiday} from ${client.business_name}! Reply STOP to opt out.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: `Write a warm, festive ${holiday} SMS message for ${client.business_name} (${client.industry}). Should feel personal and genuine, not spammy. Under 160 characters. End with 'Reply STOP to opt out.'` }],
    }),
  });
  if (!res.ok) throw new Error(`AI error: ${await res.text()}`);
  const data = await res.json();
  const text = (data?.content?.[0]?.text || "").trim();
  return text.length <= 160 ? text : text.slice(0, 157) + "...";
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  try {
    let body: { holiday: string };
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }); }

    const { holiday } = body;
    if (!holiday) return new Response(JSON.stringify({ ok: false, error: "Missing required field: holiday" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: clients, error: clientsError } = await supabase.from("holiday_sms_clients").select("id, email, business_name, industry, twilio_number, blast_count").eq("active", true);
    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, message: "No active clients" }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    let totalSent = 0;
    const reportRows: string[] = [];
    const globalErrors: string[] = [];

    for (const client of clients as HolidayClient[]) {
      try {
        const { data: contacts, error: contactsError } = await supabase.from("holiday_sms_contacts").select("id, client_email, phone, name, opted_in").eq("client_email", client.email).eq("opted_in", true);
        if (contactsError) throw contactsError;
        if (!contacts || contacts.length === 0) { reportRows.push(`${client.business_name}: 0 opted-in contacts (skipped)`); continue; }

        const message = await generateHolidayMessage(client, holiday);
        let clientSent = 0;
        const clientErrors: string[] = [];

        for (const contact of contacts as HolidayContact[]) {
          try {
            const result = await sendSMS(contact.phone, client.twilio_number, message, "holiday_sms");
            if (result.success) { clientSent++; totalSent++; }
            else if (!result.skipped) clientErrors.push(`${contact.phone}: ${result.error}`);
          }
          catch (smsErr) { clientErrors.push(`${contact.phone}: ${(smsErr as Error).message}`); }
        }

        await supabase.from("holiday_sms_clients").update({ blast_count: (client.blast_count || 0) + 1 }).eq("id", client.id);
        const summary = `${client.business_name}: ${clientSent}/${contacts.length} sent`;
        reportRows.push(clientErrors.length > 0 ? `${summary} (errors: ${clientErrors.join(" | ")})` : summary);
      } catch (clientErr) {
        const msg = `${client.business_name}: ERROR — ${(clientErr as Error).message}`;
        console.error(msg); globalErrors.push(msg); reportRows.push(msg);
      }
    }

    const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const mattHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;color:#1e293b;"><h2 style="color:#e8621a;">Holiday SMS Blast — ${holiday} (${now})</h2><p><strong>Total SMS sent:</strong> ${totalSent}</p><p><strong>Clients processed:</strong> ${clients.length}</p><h3 style="margin-top:20px;">Per-Client Summary</h3><ul>${reportRows.map((r) => `<li>${r}</li>`).join("")}</ul>${globalErrors.length > 0 ? `<p style="color:#dc2626;"><strong>Fatal errors:</strong></p><ul>${globalErrors.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}<p style="color:#64748b;font-size:12px;">M2 Development · Auto-generated report</p></body></html>`;
    await sendEmail(MATT_EMAIL, `[M²] ${holiday} SMS Blast — ${totalSent} messages sent`, mattHtml);

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});
