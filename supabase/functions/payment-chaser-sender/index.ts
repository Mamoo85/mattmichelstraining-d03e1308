import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

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

    // Route through shared sendSMS — checks sms_opt_outs (TCPA) + logs to system_comms_log
    const result = await sendSMS(customerPhone, client.phone || TWILIO_PHONE_NUMBER, msg, "payment_chaser");
    if (!result.success && !result.skipped) {
      return new Response(JSON.stringify({ error: result.error || "SMS send failed" }), { status: 502 });
    }
    if (result.skipped) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "sms_opt_out" }), { status: 200 });
    }
    await sb.from("payment_chaser_clients").update({ chase_count: (client.chase_count || 0) + 1 }).eq("id", client.id);
    return new Response(JSON.stringify({ ok: true, tone, daysOverdue, sid: result.sid }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
