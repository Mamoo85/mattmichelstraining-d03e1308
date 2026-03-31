import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

const log = (msg: string, data?: any) => {
  const d = data ? ` — ${JSON.stringify(data)}` : "";
  console.log(`[GENERATE-SPORT-GUIDE] ${msg}${d}`);
};

function buildEmailHtml(guideTitle: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="background:#f97316;padding:3px 0;"></td></tr>
    <tr><td style="text-align:center;padding:24px 0 16px;background:#0f0f1a;">
      <div style="font-size:32px;font-weight:900;color:#f97316;letter-spacing:3px;">M²</div>
      <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">PERFORMANCE TRAINING</div>
      <div style="width:40px;height:2px;background:#f97316;margin:10px auto 0;"></div>
    </td></tr>
    <tr><td style="padding:24px;background:#0f0f1a;color:#ccc;font-size:15px;line-height:1.7;">
      <p style="color:#fff;font-size:17px;font-weight:bold;margin-top:0;">Here's your playbook.</p>
      <p>Your <strong style="color:#f97316;">${guideTitle}</strong> is ready. This is built directly from my 20+ years coaching athletes — no fluff, just what actually works in the weight room and on the field.</p>
      <p>Save it. Use it. Share it with a teammate.</p>
      <p style="color:#f97316;font-weight:bold;">— Coach Matt Michels</p>
    </td></tr>
    <tr><td style="padding:0 24px 24px;background:#0f0f1a;">
      <div style="background:#111;border-left:3px solid #f97316;padding:24px;">${content}</div>
    </td></tr>
    <tr><td style="background:#0f0f1a;padding:16px 24px 24px;text-align:center;border-top:1px solid #1a1a2e;">
      <a href="https://mattmichelstraining.com" style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Join the Full Program</a>
      <div style="font-size:10px;color:#444;margin-top:8px;">M² Training · Grosse Pointe, MI</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guide_id, customer_email, stripe_session_id, user_id } = await req.json();
    if (!guide_id || !customer_email) throw new Error("guide_id and customer_email are required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Dedup check
    const templateName = `guide_delivery_${stripe_session_id}`;
    const { data: existingLog } = await sb
      .from("email_send_log")
      .select("id")
      .eq("template_name", templateName)
      .eq("recipient_email", customer_email)
      .maybeSingle();

    if (existingLog) {
      log("Already delivered", { guide_id, customer_email });
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch guide definition
    const { data: guide, error: guideError } = await sb
      .from("sport_guides" as any)
      .select("*")
      .eq("id", guide_id)
      .single();

    if (guideError || !guide) throw new Error("Guide not found: " + guide_id);

    log("Generating content for guide", { title: (guide as any).title });

    // Generate content with AI
    const prompt = (guide as any).prompt_template ||
      `Create a comprehensive sport training guide titled "${(guide as any).title}" for athletes.
       Include: an introduction (2-3 sentences), 5-7 exercises with sets/reps and coaching cues,
       a weekly program structure, recovery tips, and a motivational closing.
       Format in clean HTML with h3 headings, p tags, and strong tags for key terms.
       Write from the perspective of Coach Matt Michels — direct, no-nonsense, athlete-focused.
       Do NOT use markdown. Use only HTML tags. No backticks.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are Coach Matt Michels, an elite sports performance coach with 20+ years of experience. Write training content that is direct, practical, and built on real coaching experience. Never mention AI or technology. Always write as if this knowledge comes from years on the field.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || "";

    if (!generatedContent) throw new Error("No content generated");

    // Store in purchased_guides
    await sb.from("purchased_guides" as any).upsert({
      guide_id,
      user_id: user_id || null,
      stripe_session_id,
      customer_email,
      generated_content: generatedContent,
      emailed_at: new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });

    // Send email
    const emailHtml = buildEmailHtml((guide as any).title, generatedContent);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [customer_email],
        subject: `Your M² Playbook: ${(guide as any).title}`,
        html: emailHtml + EMAIL_SIGNATURE,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Email send failed: ${errText}`);
    }

    // Log dedup
    await sb.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: customer_email,
    });

    log("Guide delivered", { guide_id, customer_email });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GENERATE-SPORT-GUIDE] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
