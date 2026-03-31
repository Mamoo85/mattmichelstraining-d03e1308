import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("onboarding_agent_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const daysSinceCreated = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000);
        
        // Determine which email to send based on days since signup
        let emailType = "";
        if (daysSinceCreated === 1) emailType = "welcome";
        else if (daysSinceCreated === 3) emailType = "tips";
        else if (daysSinceCreated === 7) emailType = "checkin";
        else continue; // No email due today

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a ${emailType} onboarding email for a new customer of "${client.business_name}" (${client.industry || "local business"}).\n\n${emailType === "welcome" ? "Welcome them, set expectations, share quick-start tips." : emailType === "tips" ? "Share 3 pro tips for getting the most out of the service." : "Check in, ask how things are going, offer help."}\n\nKeep it under 150 words, warm and professional. Include a clear CTA.` }],
          }),
        });
        const aiData = await aiRes.json();
        const body = aiData?.choices?.[0]?.message?.content || "";

        if (RESEND_API_KEY && body) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${client.business_name} <matt@mattmichelstraining.com>`,
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: emailType === "welcome" ? `Welcome to ${client.business_name}!` : emailType === "tips" ? `3 tips to get the most out of ${client.business_name}` : `How's everything going?`,
        bcc: ["matthewmichels@gmail.com"],
              html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">${body.replace(/\n/g, "<br>")}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
          sent++;
        }

        await sb.from("onboarding_agent_clients").update({ onboard_count: (client.onboard_count || 0) + 1 }).eq("id", client.id);
      } catch (e) { console.error(`[ONBOARDING] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
