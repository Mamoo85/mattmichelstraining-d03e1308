import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { clientEmail, jobTitle, resumeText, candidateName, candidateEmail } = await req.json();
    if (!clientEmail || !resumeText || !jobTitle) return new Response(JSON.stringify({ error: "clientEmail, jobTitle, and resumeText required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: client } = await sb.from("hiring_assistant_clients").select("*").eq("email", clientEmail).eq("active", true).single();
    if (!client) return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let report = "Unable to generate screening report.";
    let score = 5;
    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite", 
          messages: [{ role: "user", content: `Screen this resume for the position "${jobTitle}" at "${client.business_name}" (${client.industry || "general"}).\n\nResume:\n${resumeText.substring(0, 2000)}\n\nProvide:\n1. SCORE: [1-10] (just the number)\n2. STRENGTHS: (3 bullet points)\n3. CONCERNS: (3 bullet points)\n4. RECOMMENDED INTERVIEW QUESTIONS: (5 questions)\n5. HIRING RECOMMENDATION: (1 sentence)` }] }) });
      const aiData = await aiRes.json();
      report = aiData?.choices?.[0]?.message?.content || report;
      const scoreMatch = report.match(/SCORE:\s*(\d+)/);
      if (scoreMatch) score = parseInt(scoreMatch[1]);
    }

    // Email screening report to client
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Hiring Assistant <matt@notify.m2training.com>", to: [client.email],
          subject: `Candidate Screening: ${candidateName || "New Applicant"} — Score ${score}/10`,
          html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;"><h2 style="color:#1e293b;">Candidate: ${candidateName || "Unknown"}</h2><p>Position: ${jobTitle}</p><pre style="white-space:pre-wrap;line-height:1.8;font-family:sans-serif;color:#334155;">${report}</pre></div>` }) });

      // If score >= 7 and candidate email provided, auto-email them
      if (score >= 7 && candidateEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${client.business_name} <matt@notify.m2training.com>`,
            to: [candidateEmail],
            subject: `Thanks for applying — ${jobTitle} at ${client.business_name}`,
            html: `<p>Hi ${candidateName || "there"},</p><p>Thanks for your interest in the <strong>${jobTitle}</strong> position at ${client.business_name}. We've reviewed your resume and would like to schedule an interview.</p><p>Please reply to this email with your availability over the next week and we'll get something on the calendar.</p><p>Looking forward to speaking with you!</p><p>— ${client.contact_name || client.business_name}</p>` }) });
      }
    }

    await sb.from("hiring_assistant_clients").update({ positions_filled: (client.positions_filled || 0) + 1 }).eq("id", client.id);
    return new Response(JSON.stringify({ ok: true, score, autoEmailed: score >= 7 && !!candidateEmail }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) { console.error("[HIRING-ASSISTANT] Error:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
