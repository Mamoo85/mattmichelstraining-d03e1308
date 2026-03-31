import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("newsletter_service_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

        // Generate newsletter content via AI
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write a professional monthly email newsletter for "${client.business_name}" (${client.industry || "local business"}) for ${month}.\n\nInclude:\n1. A compelling subject line\n2. Opening paragraph with a seasonal hook\n3. 2-3 industry tips or trends\n4. A special offer or call-to-action\n5. Brief company update section\n\nFormat the body as clean HTML. Start with SUBJECT: on the first line, then the HTML body.` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "";
        
        const subjectMatch = content.match(/SUBJECT:\s*(.+?)(\n|$)/);
        const subject = subjectMatch?.[1]?.trim() || `${client.business_name} — ${month} Newsletter`;
        const body = content.replace(/SUBJECT:\s*.+?\n/, "").trim() || "<p>Newsletter content unavailable this month.</p>";

        // Send to each subscriber
        const subscribers = client.subscriber_list || [client.email];
        if (RESEND_API_KEY && subscribers.length > 0) {
          for (const sub of subscribers) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${client.business_name} <matt@mattmichelstraining.com>`,
                to: [sub], bcc: ["matthewmichels4@gmail.com"],
                subject,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;color:#1e293b;border-radius:12px;">${body}<hr style="border-color:#e2e8f0;"><p style="color:#94a3b8;font-size:11px;">Sent by M² AI Newsletter Service on behalf of ${client.business_name}</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
              }),
            });
          }
        }

        await sb.from("newsletter_service_clients").update({ send_count: (client.send_count || 0) + 1, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[NEWSLETTER-SVC] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); console.error("[NEWSLETTER-SVC] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
