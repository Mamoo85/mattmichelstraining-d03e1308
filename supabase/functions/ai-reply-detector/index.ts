import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { senderEmail, replyBody, originalSubject } = await req.json();
    if (!senderEmail || !replyBody) {
      return new Response(JSON.stringify({ error: "senderEmail and replyBody required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Classify the reply with AI
    const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: `Classify this email reply into one category: INTERESTED, NOT_INTERESTED, WRONG_PERSON, OUT_OF_OFFICE, UNSUBSCRIBE, OTHER.\n\nFrom: ${senderEmail}\nSubject: ${originalSubject || "N/A"}\nBody: ${replyBody.slice(0, 500)}\n\nRespond with ONLY the category name.` }],
      }),
    });
    const aiData = await aiRes.json();
    const category = (aiData?.choices?.[0]?.message?.content || "OTHER").trim().toUpperCase();

    // If interested, notify Matt immediately
    if (category === "INTERESTED" && RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Lead Alert <matt@notify.m2training.com>",
          to: ["matt@m2training.com"],
          subject: `🔥 HOT LEAD: ${senderEmail} replied INTERESTED`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#22c55e;">🔥 Interested Reply Detected</h2><p><strong>From:</strong> ${senderEmail}</p><p><strong>Subject:</strong> ${originalSubject || "N/A"}</p><p><strong>Message:</strong></p><blockquote style="border-left:3px solid #e8621a;padding-left:12px;color:#94a3b8;">${replyBody.slice(0, 1000)}</blockquote><p style="color:#e8621a;font-weight:bold;">Reply to this lead ASAP!</p></div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, category, sender: senderEmail }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[REPLY-DETECTOR] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
