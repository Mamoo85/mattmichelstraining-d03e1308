import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("direct_mail_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{ role: "user", content: `Design a direct mail postcard for "${client.business_name}" (${client.industry || "local business"}) in ${client.city || "the local area"}. Provide:\n\n**FRONT (4x6 postcard):**\n- Headline (under 8 words, attention-grabbing)\n- Subheadline\n- Visual description/suggestion\n\n**BACK:**\n- Body copy (under 100 words, benefit-driven)\n- Special offer with expiry\n- Call to action with phone number placeholder\n- Business name and tagline\n\nMake it feel urgent and local.` }] }) });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "Content unavailable.";
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Direct Mail <matt@mattmichelstraining.com>", to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Your monthly postcard design — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;"><h2 style="color:#1e293b;">This Month's Direct Mail Piece</h2><pre style="white-space:pre-wrap;line-height:1.8;font-family:sans-serif;color:#334155;">${content}</pre><p style="color:#64748b;margin-top:20px;">Send this to your local printer (VistaPrint, GotPrint, etc). Standard 4x6 postcard — about $0.15 each for 500+. — Matt</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>` }) });
        }
        await sb.from("direct_mail_clients").update({ piece_count: (client.piece_count || 0) + 1, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[DIRECT-MAIL] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
