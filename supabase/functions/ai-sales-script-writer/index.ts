import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("sales_script_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{ role: "user", content: `Write 3 phone sales scripts for "${client.business_name}" (${client.industry || "local business"}):\n\n1. COLD CALL OPENER (30 seconds, pattern interrupt, get to the point)\n2. FOLLOW-UP CALL (reference previous conversation, create urgency)\n3. OBJECTION HANDLING (top 5 objections for ${client.industry || "this industry"} with rebuttals)\n\nMake them sound natural, not scripted. Include exact words to say.` }] }) });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "Scripts unavailable.";
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Sales Scripts <matt@mattmichelstraining.com>", to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Your updated sales scripts — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;"><h2 style="color:#1e293b;">This Month's Sales Scripts</h2><pre style="white-space:pre-wrap;line-height:1.8;font-family:sans-serif;color:#334155;">${content}</pre><p style="color:#64748b;margin-top:20px;">Print these out and keep them by the phone. Practice the objection handling out loud. — Matt</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>` }) });
        }
        await sb.from("sales_script_clients").update({ script_count: (client.script_count || 0) + 1, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[SALES-SCRIPTS] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
