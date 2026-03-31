import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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

    for (const contact of contacts) {
      try {
        const { data: client } = await sb.from("warranty_reminder_clients").select("*").eq("email", contact.client_email).eq("active", true).single();
        if (!client) continue;

        const expiryDate = new Date(contact.warranty_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const msg = `Hi${contact.contact_name ? " " + contact.contact_name : ""}! Your ${contact.product_name || "product"} warranty from ${client.business_name} expires ${expiryDate}. Schedule service now to stay covered! Reply YES to book or call us. Reply STOP to opt out.`;

        if (LOVABLE_API_KEY && TWILIO_API_KEY && client.twilio_number) {
          await fetch(`${GATEWAY_URL}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: contact.contact_phone, From: client.twilio_number, Body: msg }).toString(),
          });
          await sb.from("warranty_contacts").update({ sent_at: new Date().toISOString() }).eq("id", contact.id);
          await sb.from("warranty_reminder_clients").update({ reminder_count: (client.reminder_count || 0) + 1 }).eq("id", client.id);
          sent++;
        }
      } catch (e) { console.error(`[WARRANTY] Error for ${contact.contact_phone}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
