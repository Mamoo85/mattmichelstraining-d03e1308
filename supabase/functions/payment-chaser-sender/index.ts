import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

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
    if (ANTHROPIC_API_KEY) {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 150,
          messages: [{ role: "user", content: `Write a ${tone} SMS payment reminder from "${client.business_name}" to a customer. Amount: $${invoiceAmount || "outstanding"}. Days overdue: ${daysOverdue}. Under 160 chars. End with "Reply STOP to opt out."` }],
        }),
      });
      const aiData = await aiRes.json();
      msg = aiData?.content?.[0]?.text?.trim() || msg;
    }

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}` },
        body: new URLSearchParams({ To: customerPhone, From: client.phone || customerPhone, Body: msg }).toString(),
      });
    }
    await sb.from("payment_chaser_clients").update({ chase_count: (client.chase_count || 0) + 1 }).eq("id", client.id);
    return new Response(JSON.stringify({ ok: true, tone, daysOverdue }), { status: 200 });
  } catch (e: any) { console.error("[PAYMENT-CHASER] Error:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
