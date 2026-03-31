import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function detectLeadCapture(text: string): { name: string | null; phone: string | null } {
  const phoneMatch = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
  const nameMatch = text.match(/(?:my name is|i'm|i am|call me|name[:\s]+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
  return {
    phone: phoneMatch ? phoneMatch[0] : null,
    name: nameMatch ? nameMatch[1].trim() : null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, session_id, message, history = [] } = await req.json();

    if (!client_id || !session_id || !message) {
      return new Response(
        JSON.stringify({ error: "client_id, session_id, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: client, error: clientErr } = await sb
      .from("chatbot_clients")
      .select("business_name, business_type, city, active")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client.active) {
      return new Response(
        JSON.stringify({ response: "Our chat service is temporarily unavailable. Please call us directly.", lead_captured: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a helpful assistant for ${client.business_name}, a ${client.business_type || "local service business"} in ${client.city || "the local area"}. Qualify website visitors. Ask: what service do they need, their zip code, rough budget, and timeline. After 3-4 messages, if they seem interested, ask for their name, phone number, and best time to call. Be friendly and conversational. Keep responses brief (2-4 sentences). Do not mention you are an AI unless directly asked.`;

    const messages = [
      ...(Array.isArray(history) ? history.filter((m: any) => m.role && m.content) : []),
      { role: "user", content: message },
    ];

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", 
        system: systemPrompt,
        messages }) });

    const aiData = await aiRes.json();
    const response = (aiData?.choices?.[0]?.message?.content || "Thanks for reaching out! How can I help you today?").trim();

    // Check entire conversation for lead capture signals
    const allText = [...messages.map((m: any) => m.content), response].join(" ");
    const { name, phone } = detectLeadCapture(allText);
    const lead_captured = !!(name && phone);

    if (lead_captured) {
      // Save lead to contractor_leads
      await sb.from("contractor_leads").insert({
        name,
        phone,
        message: `Chatbot lead from ${client.business_name}. Session: ${session_id}. Conversation summary: ${allText.slice(0, 500)}`,
        project_type: "chatbot_inquiry",
        source: client_id });

      // Increment lead count
      await sb
        .from("chatbot_clients")
        .update({ lead_count: sb.rpc("lead_count_increment" as any) })
        .eq("id", client_id);

      // Email Matt
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Chatbot <matt@notify.m2training.com>",
            to: ["matthewmichels@mattmichelstraining.com"],
            reply_to: "matt@m2training.com",
            subject: `New chatbot lead from ${client.business_name}'s website: ${name}, ${phone}`,
            html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:500px;">
<p><strong>New lead captured from the ${client.business_name} chat widget.</strong></p>
<p><strong>Name:</strong> ${name}<br>
<strong>Phone:</strong> ${phone}<br>
<strong>Business:</strong> ${client.business_name} (${client.city || ""})</p>
<p style="font-size:13px;color:#64748b;">Session ID: ${session_id}</p>
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
  <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
</div>
</div>` }) });
      }
    }

    return new Response(
      JSON.stringify({ response, lead_captured }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[CHATBOT-WIDGET] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
