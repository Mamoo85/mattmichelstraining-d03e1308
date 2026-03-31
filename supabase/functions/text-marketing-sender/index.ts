import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const singleClient = body?.clientEmail || null;

    const query = sb.from("text_marketing_clients").select("id, business_name, contact_name, email, twilio_number, industry, campaign_count").eq("active", true);
    if (singleClient) query.eq("email", singleClient);

    const { data: clients, error } = await query;
    if (error) throw error;
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let totalSent = 0;

    for (const client of clients) {
      try {
        if (!client.twilio_number) { console.warn(`[TEXT-MARKETING] No twilio_number for ${client.email}`); continue; }

        const { data: contacts } = await sb.from("text_marketing_contacts").select("contact_phone, contact_name").eq("client_email", client.email).eq("opted_in", true);
        if (!contacts?.length) { console.warn(`[TEXT-MARKETING] No contacts for ${client.email}`); continue; }

        let campaignText = `Hey! ${client.business_name} here. Hope your month is going great! Reply STOP to unsubscribe.`;
        if (LOVABLE_API_KEY) {
          try {
            const claudeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [{ role: "user", content: `Write a short, friendly SMS marketing message for ${client.business_name} (industry: ${client.industry || "local business"}). Promote their services, create a sense of urgency or value, be conversational and under 160 characters. End with "Reply STOP to unsubscribe." Return only the message text.` }],
              }),
            });
            if (claudeRes.ok) {
              const claudeData = await claudeRes.json();
              campaignText = claudeData?.choices?.[0]?.message?.content?.trim() || campaignText;
            }
          } catch { /* use default */ }
        }

        let sentCount = 0;
        if (LOVABLE_API_KEY && TWILIO_API_KEY) {
          for (const contact of contacts) {
            const smsRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TWILIO_API_KEY,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: contact.contact_phone, From: client.twilio_number, Body: campaignText }).toString(),
            });
            if (smsRes.ok) sentCount++;
          }
        }

        await sb.from("text_marketing_clients").update({ campaign_count: (client.campaign_count || 0) + 1 }).eq("id", client.id);
        totalSent += sentCount;

        if (RESEND_API_KEY && client.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Text Marketing <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `📱 Your monthly SMS campaign was sent — ${sentCount} messages`,
              html: `<p>Your monthly text campaign just went out!</p><p><strong>Campaign #${(client.campaign_count || 0) + 1}</strong><br>Messages sent: ${sentCount}<br>Contact list size: ${contacts.length}</p><hr/><p><strong>Message sent:</strong></p><blockquote>${campaignText}</blockquote><p>Reply here with any questions. — Matt<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
            }),
          });
        }

        console.log(`[TEXT-MARKETING] Sent ${sentCount} messages for ${client.business_name}`);
      } catch (clientErr) { console.error(`[TEXT-MARKETING] Error for ${client.email}:`, clientErr); }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) { console.error("[TEXT-MARKETING] Fatal error:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
