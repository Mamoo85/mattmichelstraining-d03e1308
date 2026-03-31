import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("google_qa_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{ role: "user", content: `Write 5 commonly asked Google Business Profile Q&A pairs for "${client.business_name}". Format each as:\nQ: [question]\nA: [answer]\n\nMake answers helpful, specific, and SEO-friendly. Include business hours, service area, pricing approach, and specialties.` }] }) });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "Unable to generate Q&A.";
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Google Q&A <matt@mattmichelstraining.com>", to: [client.email],
              subject: `Your weekly Google Q&A — ${client.business_name}`,
              html: `<p>Here are 5 fresh Q&A pairs to post on your Google Business Profile this week:</p><pre style="white-space:pre-wrap;font-family:sans-serif;line-height:1.8;">${content}</pre><p>Post these in your GBP dashboard under "Questions & Answers" to boost your local ranking.</p><p>— Matt<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>` }) });
        }
        await sb.from("google_qa_clients").update({ answer_count: (client.answer_count || 0) + 5 }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[GOOGLE-QA] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[GOOGLE-QA] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
