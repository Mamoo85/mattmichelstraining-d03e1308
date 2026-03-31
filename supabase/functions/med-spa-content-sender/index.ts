import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await (sb.from as any)("med_spa_marketing_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const week = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
        const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write a complete monthly marketing content pack for "${client.business_name}", a med spa${client.services ? " offering: " + client.services : ""}${client.city ? " in " + client.city : ""}.

Include:
1. 4 Instagram/Facebook post captions (engaging, professional, with hashtags)
2. 1 monthly email campaign (subject line + full HTML body, 200-300 words)
3. 5 Google review request message templates (warm, conversational)

Format clearly with headers. Make the social posts feel luxurious and results-focused. Email should nurture existing clients and drive rebooking.` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "Content unavailable this month.";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Development <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `${client.business_name} — ${week} Marketing Content Pack`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">✨ Monthly Med Spa Marketing Pack</h2><p>Here's your ${week} content. Copy, post, and watch the bookings come in:</p><pre style="white-space:pre-wrap;font-family:sans-serif;color:#e2e8f0;">${content}</pre><hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Development — matt@m2training.com</p></div>`,
            }),
          });
        }
        await (sb.from as any)("med_spa_marketing_clients").update({ last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[MED-SPA-SENDER] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
