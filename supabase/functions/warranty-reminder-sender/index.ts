import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    const now = new Date().toISOString();

    const { data: contacts } = await sb
      .from("warranty_contacts")
      .select("id, client_email, contact_phone, contact_name, warranty_expires_at, product_name, sent_at")
      .lte("warranty_expires_at", thirtyDaysOut.toISOString())
      .gte("warranty_expires_at", now)
      .is("sent_at", null);

    if (!contacts?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    let skipped = 0;

    for (const contact of contacts) {
      try {
        const { data: client } = await sb.from("warranty_reminder_clients").select("*").eq("email", contact.client_email).eq("active", true).single();
        if (!client || !client.twilio_number) continue;

        const expiryDate = new Date(contact.warranty_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const msg = `Hi${contact.contact_name ? " " + contact.contact_name : ""}! Your ${contact.product_name || "product"} warranty from ${client.business_name} expires ${expiryDate}. Schedule service now to stay covered! Reply YES to book or call us. Reply STOP to opt out.`;

        // Route through shared sendSMS — TCPA opt-out check + system_comms_log
        const result = await sendSMS(contact.contact_phone, client.twilio_number, msg, "warranty_reminder");
        if (result.skipped) {
          skipped++;
          await sb.from("warranty_contacts").update({ sent_at: new Date().toISOString() }).eq("id", contact.id);
          continue;
        }
        if (!result.success) continue;
        await sb.from("warranty_contacts").update({ sent_at: new Date().toISOString() }).eq("id", contact.id);
        await sb.from("warranty_reminder_clients").update({ reminder_count: (client.reminder_count || 0) + 1 }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[WARRANTY] Error for ${contact.contact_phone}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent, skipped }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
