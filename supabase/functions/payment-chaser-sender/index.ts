import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

async function sendSmsGateway(to: string, from: string, body: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio gateway error [${res.status}]: ${err}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { clientEmail, customerPhone, customerName, invoiceAmount, dueDate } = await req.json();
    if (!clientEmail || !customerPhone) return new Response(JSON.stringify({ error: "clientEmail and customerPhone required" }), { status: 400 });

    const { data: client } = await sb.from("payment_chaser_clients").select("*").eq("email", clientEmail).eq("active", true).single();
    if (!client) return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404 });

    const daysOverdue = dueDate ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;
    let tone = "friendly";
    if (daysOverdue > 21) tone = "final notice";
    else if (daysOverdue > 10) tone = "urgent";
    else if (daysOverdue > 5) tone = "firmer";

    let msg = `Hi${customerName ? " " + customerName : ""}, this is a reminder from ${client.business_name} regarding your invoice of $${invoiceAmount || "outstanding"}. Please contact us to arrange payment. Reply STOP to opt out.`;

    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a ${tone} SMS payment reminder from "${client.business_name}" to a customer. Amount: $${invoiceAmount || "outstanding"}. Days overdue: ${daysOverdue}. Under 160 chars. End with "Reply STOP to opt out."` }],
          }),
        });
        const aiData = await aiRes.json();
        msg = aiData?.choices?.[0]?.message?.content?.trim() || msg;
      } catch { /* fallback to default msg */ }
    }

    await sendSmsGateway(customerPhone, client.phone || customerPhone, msg);
    await sb.from("payment_chaser_clients").update({ chase_count: (client.chase_count || 0) + 1 }).eq("id", client.id);
    return new Response(JSON.stringify({ ok: true, tone, daysOverdue }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
