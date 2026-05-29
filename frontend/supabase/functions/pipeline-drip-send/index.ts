import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DRIP_STEPS = [
  {
    step: 1,
    delay_days: 0,
    prompt_suffix: `Write a SHORT cold email (3-4 sentences max). The first line MUST reference a specific gap or issue from the gap analysis. Offer a pre-built demo. No buzzwords. Sound like a local contractor, not a marketer.`,
  },
  {
    step: 2,
    delay_days: 3,
    prompt_suffix: `Write a SHORT follow-up (2-3 sentences). Reference the previous email about their specific gap. Ask if they had 2 minutes to look at the demo. Add one new observation. No buzzwords.`,
  },
  {
    step: 3,
    delay_days: 7,
    prompt_suffix: `Write a SHORT value-add email (3 sentences). Share one actionable tip specific to their industry. Mention you noticed something new on their site. Keep it casual, like texting a neighbor.`,
  },
  {
    step: 4,
    delay_days: 14,
    prompt_suffix: `Write a SHORT final-touch email (2-3 sentences). Be direct: "I'm going to stop bugging you, but I wanted to leave this here." Reference the original gap one last time. Make it feel human and final.`,
  },
];

const EMAIL_SIGNATURE = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;">
  <div style="font-size:13px;color:#94a3b8;">
    <strong style="color:#e2e8f0;">Matt Michels</strong> | Lead Web Agent<br/>
    Detroit Web Agency · (313) 992-1219
  </div>
</div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leadId, action } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: lead, error: leadErr } = await sb
      .from("prospect_pipeline")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      throw new Error(leadErr?.message || "Lead not found");
    }

    if (!lead.email) {
      return new Response(JSON.stringify({ error: "Lead has no email — cannot send drip" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentStep = (lead.drip_step || 0) + 1;
    if (currentStep > 4) {
      return new Response(JSON.stringify({ error: "Drip sequence complete for this lead" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stepConfig = DRIP_STEPS[currentStep - 1];
    const gapAnalysis = lead.gap_analysis || lead.deep_research?.summary || "";
    const coreService = lead.core_service || "";
    const specificSiteFlaw = lead.specific_site_flaw || "";
    const recentActivity = lead.recent_activity || "";
    // Map industry to demo page
    const DEMO_MAP: Record<string, string> = {
      roofing: "/demo-roofing", plumber: "/demo-plumber", plumbing: "/demo-plumber",
      electrician: "/demo-electrician", electrical: "/demo-electrician",
      lawyer: "/demo-lawyer", attorney: "/demo-lawyer", "law firm": "/demo-lawyer",
      dental: "/demo-dental", dentist: "/demo-dental",
      clinic: "/demo-clinic", medical: "/demo-clinic", healthcare: "/demo-clinic",
      landscaping: "/demo-landscaping", "lawn care": "/demo-landscaping",
      "real estate": "/demo-real-estate", realtor: "/demo-real-estate",
    };
    const industryLower = (lead.industry || "").toLowerCase();
    const demoSlug = Object.entries(DEMO_MAP).find(([k]) => industryLower.includes(k))?.[1] || "/demo-home";
    const demoUrl = `https://www.detroitwebagent.com${demoSlug}`;

    // If action is "draft" — generate but don't send
    // If action is "send" — generate and send
    // If action is "send_existing" — send the already-drafted email

    let subject = lead.drip_subject;
    let body = lead.drip_body;

    if (action !== "send_existing" || !subject || !body) {
      // Generate with AI
      if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

      const prompt = `You are writing a cold email on behalf of Matt Michels, Lead Web Agent at Detroit Web Agency (Grosse Pointe, MI).

LEAD INTEL:
Business: ${lead.business_name}
Industry: ${lead.industry || "local business"}
City: ${lead.city || "Metro Detroit"}
Website: ${lead.website || "none found"}
Core Service: "${coreService}"
Specific Site Flaw: "${specificSiteFlaw}"
Recent Activity: "${recentActivity}"
Gap Summary: "${gapAnalysis}"
Demo Link: ${demoUrl}
Drip Step: ${currentStep} of 4
${currentStep > 1 ? "This is a FOLLOW-UP email. The prospect has already received " + (currentStep - 1) + " email(s)." : "This is the FIRST cold email."}

EMAIL FRAMEWORK (follow this EXACTLY for Step 1):
1. HOOK: Start with a compliment or observation about their specific business. Reference their "${recentActivity || coreService}" to prove you actually looked at them.
2. THE PROBLEM: Casually mention you noticed "${specificSiteFlaw}" while browsing their site.
3. THE UNREASONABLE OFFER: Say something like "Because I focus specifically on helping Michigan ${lead.industry || "local"} businesses, I actually went ahead and built a live demo of a new, automated site specifically for ${lead.business_name}. It fixes that [flaw] and includes a 24/7 lead-routing engine."
4. CTA: "Do you have 2 minutes for me to send the private link over so you can see it?"

For Steps 2-4:
${stepConfig.prompt_suffix}
${currentStep === 2 ? `- Reference the demo link (${demoUrl}) again and ask if they had a chance to look at it.` : ""}

TONE RULES:
- Speak like Matt Michels — a local Detroit guy, not a marketing agency
- Keep it under 5 sentences total
- NEVER say "Hope this finds you well" or "Dear Business Owner"  
- NEVER use: AI, Synergy, Algorithm, Digital Transformation, Leverage, Game-Changer, "cutting edge"
- In Step 1, you MUST include the demo link: ${demoUrl}
- Sign off: Matt Michels | Lead Web Agent | Detroit Web Agency

Return JSON: {"subject": "...", "body": "..."}
Return ONLY valid JSON, no markdown.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);
      const ai = await aiRes.json();
      const raw = ai.choices?.[0]?.message?.content?.trim() || "";

      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        subject = parsed.subject || `Quick note about ${lead.business_name}`;
        body = parsed.body || raw;
      } catch {
        subject = `Quick note about ${lead.business_name}`;
        body = raw;
      }
    }

    if (action === "draft") {
      // Save draft without sending
      await sb.from("prospect_pipeline").update({
        drip_subject: subject,
        drip_body: body,
        drip_status: "drafted",
        updated_at: new Date().toISOString(),
      }).eq("id", leadId);

      return new Response(JSON.stringify({ success: true, action: "drafted", subject, body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the email
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const htmlBody = body
      .split("\n")
      .map((line: string) => line.trim() === "" ? "<br>" : `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#333;">${line}</p>`)
      .join("\n") + EMAIL_SIGNATURE;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels | Detroit Web Agency <matt@detroitwebagent.com>",
        reply_to: "matt@detroitwebagent.com",
        to: [lead.email],
        bcc: ["matthewmichels4@gmail.com"],
        subject,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      if (emailRes.status === 429) {
        return new Response(JSON.stringify({ error: "Daily email quota exceeded — try again tomorrow or upgrade your Resend plan" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Email send failed: ${emailRes.status}`);
    }

    // Log to prospect_email_log
    const resendData = await emailRes.json();
    await sb.from("prospect_email_log").insert({
      pipeline_lead_id: leadId,
      business_name: lead.business_name,
      recipient_email: lead.email,
      subject,
      drip_step: currentStep,
      status: "sent",
      resend_id: resendData?.id || null,
    });

    // Update pipeline lead
    await sb.from("prospect_pipeline").update({
      drip_step: currentStep,
      drip_status: currentStep >= 4 ? "completed" : "active",
      drip_subject: subject,
      drip_body: body,
      last_drip_at: new Date().toISOString(),
      pipeline_stage: "outreach_sent",
      updated_at: new Date().toISOString(),
    }).eq("id", leadId);

    return new Response(JSON.stringify({
      success: true,
      action: "sent",
      step: currentStep,
      subject,
      sentTo: lead.email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pipeline-drip-send]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
