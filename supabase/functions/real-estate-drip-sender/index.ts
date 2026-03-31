import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await (sb.from as any)("real_estate_drip_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write a monthly real estate drip email pack for ${client.business_name}${client.city ? ", a real estate agent/broker in " + client.city : ""}.

Include:
1. Monthly market update newsletter (subject line + full HTML body, 300-400 words) — general real estate insights and tips, not specific pricing
2. 3 lead nurture email templates (for cold leads, warm leads, and past clients)
3. 1 listing announcement email template (customizable)

Format with clear section headers. Professional, trustworthy, conversational tone. Month: ${month}.` }],
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
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `${client.business_name} — ${month} Drip Email Pack`,
        bcc: ["matthewmichels@gmail.com"],
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🏠 Monthly Real Estate Drip Pack</h2><p>Your ${month} email templates are ready. Copy and send:</p><pre style="white-space:pre-wrap;font-family:sans-serif;color:#e2e8f0;">${content}</pre><p style="color:#64748b;font-size:12px;">Powered by M² Development — matt@m2training.com</p></div>`,
            }),
          });
        }
        await (sb.from as any)("real_estate_drip_clients").update({ last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[RE-DRIP-SENDER] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
