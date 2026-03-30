import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

// Default Twilio number used as fallback if client has no twilio_number configured
const DEFAULT_TWILIO_NUMBER = Deno.env.get("TWILIO_DEFAULT_NUMBER") || "";

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
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { clientEmail, customerPhone, customerName } = await req.json();

    if (!clientEmail || !customerPhone) {
      return new Response(
        JSON.stringify({ error: "clientEmail and customerPhone are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Look up client in review_request_clients
    const clients: Array<{
      id: string;
      email: string;
      business_name: string;
      twilio_number?: string;
      google_review_url: string;
      requests_sent: number;
      active: boolean;
    }> = await supabaseQuery(
      `review_request_clients?select=*&email=eq.${encodeURIComponent(clientEmail)}&active=eq.true`
    );

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Client not found or not active" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const client = clients[0];
    const fromNumber = client.twilio_number || DEFAULT_TWILIO_NUMBER;

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: "No Twilio number configured for this client and no default number set" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const greeting = customerName ? `Hi ${customerName}` : "Hi there";
    const message = `${greeting}! Thanks for choosing ${client.business_name}. We'd love your feedback — could you leave us a quick Google review? ${client.google_review_url} Reply STOP to opt out.`;

    await sendSms(fromNumber, customerPhone, message);

    // Increment requests_sent
    await supabaseQuery(
      `review_request_clients?id=eq.${client.id}`,
      { requests_sent: (client.requests_sent || 0) + 1 },
      "PATCH"
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
