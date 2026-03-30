import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("google_qa_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", max_tokens: 800,
            messages: [{ role: "user", content: `Write 5 commonly asked Google Business Profile Q&A pairs for "${client.business_name}". Format each as:\nQ: [question]\nA: [answer]\n\nMake answers helpful, specific, and SEO-friendly. Include business hours, service area, pricing approach, and specialties.` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.content?.[0]?.text || "Unable to generate Q&A.";
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Google Q&A <matt@notify.m2training.com>", to: [client.email],
              subject: `Your weekly Google Q&A — ${client.business_name}`,
              html: `<p>Here are 5 fresh Q&A pairs to post on your Google Business Profile this week:</p><pre style="white-space:pre-wrap;font-family:sans-serif;line-height:1.8;">${content}</pre><p>Post these in your GBP dashboard under "Questions & Answers" to boost your local ranking.</p><p>— Matt</p>`,
            }),
          });
        }
        await sb.from("google_qa_clients").update({ answer_count: (client.answer_count || 0) + 5 }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[GOOGLE-QA] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[GOOGLE-QA] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
