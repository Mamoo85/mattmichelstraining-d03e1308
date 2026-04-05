// Invoice Chaser Runner — cron daily 9am ET + intake endpoint
// Sends payment reminders at 7, 14, 21 days past due. Stops when marked paid.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const REMINDER_DAYS = [7, 14, 21]; // days past due_date to send reminders

function buildMessage(step: number, customerName: string, businessName: string, amount: number, daysLate: number): string {
  const name = customerName ? ` ${customerName.split(" ")[0]}` : "";
  const amt = amount ? ` for $${amount.toFixed(2)}` : "";
  const msgs = [
    `Hi${name}, a friendly reminder that your invoice${amt} from ${businessName} is now ${daysLate} days past due. Please let us know if you have questions — we appreciate your business!`,
    `Hi${name}, this is a second notice: your invoice${amt} from ${businessName} is ${daysLate} days overdue. Please send payment at your earliest convenience or contact us to arrange an alternative.`,
    `Hi${name}, final notice: your invoice${amt} from ${businessName} remains unpaid at ${daysLate} days past due. Please contact us immediately to resolve this — we'd like to avoid escalating further.`,
  ];
  return msgs[Math.min(step, msgs.length - 1)];
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // POST = add new invoice to track
  if (req.method === "POST") {
    try {
      const { client_email, customer_name, customer_phone, customer_email, invoice_amount, due_date } = await req.json();
      if (!client_email || !customer_phone || !due_date) return new Response(JSON.stringify({ error: "client_email, customer_phone, due_date required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: client } = await sb.from("invoice_chaser_clients").select("id").eq("email", client_email).eq("active", true).maybeSingle();
      if (!client) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const dueDate = new Date(due_date);
      const firstReminder = new Date(dueDate.getTime() + REMINDER_DAYS[0] * 86400 * 1000).toISOString();

      await sb.from("tracked_invoices").insert({ client_id: client.id, customer_name: customer_name || null, customer_phone, customer_email: customer_email || null, invoice_amount: invoice_amount || null, due_date, reminders_sent: 0, next_reminder_at: firstReminder });

      return new Response(JSON.stringify({ tracking: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: unknown) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // GET/cron = send due reminders
  const now = new Date();
  const { data: invoices } = await sb.from("tracked_invoices")
    .select("*, invoice_chaser_clients(business_name)")
    .eq("paid", false)
    .lte("next_reminder_at", now.toISOString())
    .lt("reminders_sent", REMINDER_DAYS.length)
    .limit(100);

  if (!invoices?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let sent = 0;
  for (const inv of invoices) {
    try {
      const client = inv.invoice_chaser_clients as any;
      const daysLate = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
      const message = buildMessage(inv.reminders_sent, inv.customer_name, client?.business_name || "us", inv.invoice_amount, daysLate);

      const result = await sendSMS(inv.customer_phone, TWILIO_FROM_NUMBER, message, "invoice_chaser");
      if (!result.success) continue;

      sent++;
      const nextStep = inv.reminders_sent + 1;
      const isLast = nextStep >= REMINDER_DAYS.length;

      if (isLast) {
        await sb.from("tracked_invoices").update({ reminders_sent: nextStep, next_reminder_at: null }).eq("id", inv.id);
      } else {
        const daysDiff = REMINDER_DAYS[nextStep] - REMINDER_DAYS[inv.reminders_sent];
        const nextReminder = new Date(now.getTime() + daysDiff * 86400 * 1000).toISOString();
        await sb.from("tracked_invoices").update({ reminders_sent: nextStep, next_reminder_at: nextReminder }).eq("id", inv.id);
      }

      // Email customer too if we have their email
      if (RESEND_API_KEY && inv.customer_email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `${client?.business_name || "M²"} <matt@mattmichelstraining.com>`, to: [inv.customer_email], subject: `Invoice Reminder — ${daysLate} days past due`, html: `<p>${message}</p>` }),
        });
      }
    } catch (e) {
      console.error(`[invoice-chaser] Error for invoice ${inv.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent, total: invoices.length }), { status: 200 });
});
