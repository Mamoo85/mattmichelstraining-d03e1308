import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await (sb.from as any)("franchise_ops_clients").select("*").eq("active", true);
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
            messages: [{ role: "user", content: `Write a monthly operations pack for "${client.business_name}"${client.locations ? ", a franchise/multi-location business with " + client.locations + " locations" : ""}.

Include:
1. Monthly staff operations newsletter (internal, 300-400 words, motivating + operational updates)
2. Monthly compliance checklist (10-15 items relevant to multi-location food service/retail/service businesses)
3. Policy update announcement template (customizable)
4. New location onboarding checklist (20 items)
5. Monthly performance digest email template (for franchise owners to send to location managers)

Professional operations tone. Month: ${month}.` }],
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
              subject: `${client.business_name} — ${month} Franchise Ops Pack`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🏪 Monthly Franchise Ops Pack</h2><p>Your ${month} operations documents are ready:</p><pre style="white-space:pre-wrap;font-family:sans-serif;color:#e2e8f0;">${content}</pre><p style="color:#64748b;font-size:12px;">Powered by M² Development — matt@m2training.com</p></div>`,
            }),
          });
        }
        await (sb.from as any)("franchise_ops_clients").update({ last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[FRANCHISE-OPS-SENDER] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
