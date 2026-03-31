import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, business_name, email, phone, service, message, industry, source } = await req.json();

    if (!name || !business_name || !email || !service) {
      return new Response(
        JSON.stringify({ error: "name, business_name, email, and service are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Generate AI summary via Claude Haiku
    let ai_summary = "";
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite", 
          messages: [
            {
              role: "user",
              content: `You are Agent Smith, a business analyst. Summarize this lead in 3 sentences: Name: ${name}, Business: ${business_name}, Service: ${service}, Message: ${message || "none provided"}. Include: (1) who they are, (2) what they need, (3) urgency/fit assessment (high/medium/low value).` },
          ] }) });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        ai_summary = aiData?.choices?.[0]?.message?.content || "";
      }
    } catch (aiErr) {
      console.error("[SUBMIT-INTAKE] AI summary error:", aiErr);
    }

    // 2. Insert into intake_leads
    const { error: dbError } = await sb
      .from("intake_leads" as any)
      .insert({
        name,
        business_name,
        email,
        phone: phone || null,
        service,
        message: message || null,
        ai_summary: ai_summary || null,
        status: "new" });

    if (dbError) {
      console.error("[SUBMIT-INTAKE] DB error:", dbError);
      throw new Error(dbError.message);
    }

    // 2b. Track conversion if came from drip
    if (source && source !== "direct") {
      await sb.from("drip_conversions" as any).insert({
        email,
        business_name,
        industry: industry || null,
        service_interested: service,
        source: source || "direct",
        drip_step_converted: source,
      });
    }

    // 2c. Add to marketing_leads for unified tracking
    await sb.from("marketing_leads").upsert({
      email,
      first_name: name?.split(" ")[0] || null,
      source: source || "get-started",
      industry: industry || null,
      service_interested: service,
      phone: phone || null,
      business_name,
      utm_source: source || "direct",
    }, { onConflict: "email" });

    // 3. Send notification email to Matt
    if (RESEND_API_KEY) {
      const replySubject = encodeURIComponent(`Re: ${name} — ${service}`);
      const replyBody = encodeURIComponent(`Hi ${name},\n\nThanks for reaching out!`);
      const mailtoHref = `mailto:${email}?subject=${replySubject}&body=${replyBody}`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { background: #1e293b; color: white; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 900; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }
    .body { padding: 24px 28px; }
    .field { margin-bottom: 16px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 3px; }
    .value { font-size: 14px; color: #1e293b; }
    .ai-box { border-left: 3px solid #e8621a; background: #fff7f4; padding: 14px 16px; border-radius: 4px; margin: 20px 0; }
    .ai-box .ai-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #e8621a; margin-bottom: 6px; }
    .ai-box p { margin: 0; font-size: 13px; color: #1e293b; line-height: 1.6; }
    .cta { text-align: center; padding: 8px 0 4px; }
    .btn { display: inline-block; background: #e8621a; color: white !important; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 6px; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>New Intake Lead</h1>
      <p>${name} — ${service}</p>
    </div>
    <div class="body">
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${name}</div>
      </div>
      <div class="field">
        <div class="label">Business</div>
        <div class="value">${business_name}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}" style="color:#e8621a">${email}</a></div>
      </div>
      ${phone ? `<div class="field"><div class="label">Phone</div><div class="value"><a href="tel:${phone}" style="color:#e8621a">${phone}</a></div></div>` : ""}
      <div class="field">
        <div class="label">Service Interested In</div>
        <div class="value">${service}</div>
      </div>
      ${message ? `<div class="field"><div class="label">Message</div><div class="value" style="white-space:pre-wrap">${message}</div></div>` : ""}
      <hr>
      ${ai_summary ? `
      <div class="ai-box">
        <div class="ai-label">AI Lead Summary</div>
        <p>${ai_summary}</p>
      </div>
      ` : ""}
      <div class="cta">
        <a href="${mailtoHref}" class="btn">Reply to ${name}</a>
      </div>
    </div>
  </div>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matthewmichels@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          reply_to: email,
          subject: `New lead: ${name} — ${service}`,
          html }) });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[SUBMIT-INTAKE] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
