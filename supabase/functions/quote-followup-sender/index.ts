import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function supabaseQuery(path: string, body?: unknown, method = "GET") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${text}`);
  }
  if (method === "GET") return res.json();
  return null;
}

async function sendSms(from: string, to: string, body: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio gateway error: ${await res.text()}`);
  return res.json();
}

function buildStepMessage(step: number, prospectName: string, businessName: string, service: string): string {
  if (step === 1) return `Hi ${prospectName}! This is ${businessName} following up on your recent quote for ${service}. Any questions? We'd love to earn your business! — ${businessName}`;
  else if (step === 2) return `Hey ${prospectName}, just checking in on that ${service} quote we sent. We have a slot available this week if you're ready to move forward. Give us a call!`;
  else return `Hi ${prospectName}, last follow-up on your ${service} quote from ${businessName}. We want to make sure you get the best deal — reply YES to lock in your price.`;
}

function nextSendOffsetMs(currentStep: number): number {
  if (currentStep === 1) return 2 * 24 * 60 * 60 * 1000;
  return 3 * 24 * 60 * 60 * 1000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const now = new Date().toISOString();
    const sequences: Array<{
      id: string; client_email: string; prospect_name: string; prospect_phone: string;
      service: string; step: number; next_send_at: string; sent_at: string | null; completed: boolean;
    }> = await supabaseQuery(
      `quote_followup_sequences?select=*&completed=eq.false&next_send_at=lte.${encodeURIComponent(now)}&sent_at=is.null`
    );

    let sent = 0;

    for (const seq of sequences) {
      try {
        const clients: Array<{
          id: string; client_email: string; business_name: string; twilio_number: string; active: boolean;
        }> = await supabaseQuery(`quote_followup_clients?select=*&client_email=eq.${encodeURIComponent(seq.client_email)}&active=eq.true`);

        if (!clients || clients.length === 0) { console.error(`No active client found for email: ${seq.client_email}`); continue; }

        const client = clients[0];
        const message = buildStepMessage(seq.step, seq.prospect_name, client.business_name, seq.service);
        await sendSms(client.twilio_number, seq.prospect_phone, message);

        await supabaseQuery(`quote_followup_sequences?id=eq.${seq.id}`, { sent_at: new Date().toISOString() }, "PATCH");

        if (seq.step >= 3) {
          await supabaseQuery(`quote_followup_sequences?id=eq.${seq.id}`, { completed: true }, "PATCH");
        } else {
          const nextStep = seq.step + 1;
          const nextSendAt = new Date(Date.now() + nextSendOffsetMs(seq.step)).toISOString();
          await supabaseQuery("quote_followup_sequences", {
            client_email: seq.client_email, prospect_name: seq.prospect_name, prospect_phone: seq.prospect_phone,
            service: seq.service, step: nextStep, next_send_at: nextSendAt, sent_at: null, completed: false,
          }, "POST");
        }

        sent++;
      } catch (seqErr: any) { console.error(`Error processing sequence ${seq.id}:`, seqErr.message); }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
